import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

/** Absolute path to the repo root, two levels above `test/docs`. */
export const REPO_ROOT = resolve(__dirname, '..', '..');

/**
 * One markdown link. `targetPath` is repo-relative and already resolved
 * against the linking file's directory; it equals `file` for a pure `#anchor`
 * link. `anchor` excludes the `#` and is `''` when the link has none. `text`
 * has backticks stripped and whitespace collapsed, so a link wrapped across
 * two source lines reads as one string.
 */
export interface DocLink {
  file: string;
  line: number;
  text: string;
  target: string;
  targetPath: string;
  anchor: string;
}

/** One markdown file. `headings` keeps the leading `#` characters. */
export interface DocPage {
  path: string;
  headings: string[];
  body: string;
}

/**
 * Everything a docs check needs from one read of the repo. `contexts` is
 * every directory under `src/` that has its own `domain/` layer, excluding
 * the shared kernel; it is not a fixed name list, so a new bounded context
 * appears here the moment that layer exists.
 */
export interface DocsModel {
  contexts: string[];
  pages: DocPage[];
  links: DocLink[];
}

// Agent scratch (TODO.md, .superpowers/) is gitignored but present on disk, and
// build output contains copies of nothing we document. Both would produce
// findings nobody can act on.
const SKIPPED_DIRS = new Set(['node_modules', 'dist', 'coverage', 'drizzle']);
const SKIPPED_FILES = new Set(['TODO.md']);

const LINK = /\[([^\]]+)\]\(([^)]+)\)/g;

function walkMarkdown(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || SKIPPED_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walkMarkdown(full, found);
    else if (entry.endsWith('.md') && !SKIPPED_FILES.has(entry)) {
      found.push(relative(REPO_ROOT, full));
    }
  }
  return found;
}

/**
 * GitHub's heading anchor form: lowercase, punctuation dropped, spaces to
 * hyphens. Accepts a heading with or without its leading `#` characters.
 */
export function slugify(heading: string): string {
  return heading
    .replace(/^#+\s*/, '')
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .trim()
    .replace(/ +/g, '-');
}

function parseLinks(file: string, body: string): DocLink[] {
  const links: DocLink[] = [];
  for (const match of body.matchAll(LINK)) {
    const target = match[2].trim();
    if (/^(https?:|mailto:)/.test(target)) continue;
    const [path, anchor = ''] = target.split('#');
    links.push({
      file,
      line: body.slice(0, match.index).split('\n').length,
      text: match[1].replace(/`/g, '').replace(/\s+/g, ' ').trim(),
      target,
      targetPath:
        path === ''
          ? file
          : relative(REPO_ROOT, resolve(REPO_ROOT, dirname(file), path)),
      anchor,
    });
  }
  return links;
}

/**
 * A context is a directory under `src/` that has its own `domain/` layer,
 * excluding the shared kernel. Keyed on the layer rather than on a name list
 * so a new context is recognised the moment its directory exists.
 */
function readContexts(): string[] {
  return readdirSync(join(REPO_ROOT, 'src'), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        entry.name !== 'shared' &&
        existsSync(join(REPO_ROOT, 'src', entry.name, 'domain')),
    )
    .map((entry) => entry.name)
    .sort();
}

/** Reads every tracked markdown file and `src/` once. Throws on unreadable files. */
export function readDocsModel(): DocsModel {
  const pages = walkMarkdown(REPO_ROOT).map((path) => {
    const body = readFileSync(join(REPO_ROOT, path), 'utf8');
    return {
      path,
      body,
      headings: body.split('\n').filter((line) => /^#{1,6} /.test(line)),
    };
  });

  return {
    contexts: readContexts(),
    pages,
    links: pages.flatMap((page) => parseLinks(page.path, page.body)),
  };
}

/**
 * The headings every context page must carry, in order. Extra headings are
 * allowed anywhere; these five are the checked minimum.
 */
export const CONTEXT_PAGE_HEADINGS = [
  '## What it owns',
  '## Endpoints',
  '## Ports and adapters',
  '## Request lifecycle',
  '## Error codes',
] as const;
