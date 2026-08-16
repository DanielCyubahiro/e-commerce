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

/**
 * Marker an entry carries instead of an instance table when the term is a
 * repo-wide rule rather than a pattern instantiated per context. Deliberately
 * a literal in the docs rather than a list in this file: an exemption list
 * here would be invisible to whoever writes the entry.
 */
export const REPO_WIDE_RULE_MARKER =
  '**Repo-wide rule, no per-context instances.**';

/** One `###` entry in `docs/concepts.md`. `locations` is the instance table's first column. */
export interface GlossaryEntry {
  term: string;
  locations: string[];
  isRepoWideRule: boolean;
}

/**
 * Parses every `###` entry out of `docs/concepts.md`. `locations` is read off
 * whatever pipe-delimited rows follow the heading, so a malformed row (one
 * missing a closing `|`, say) is silently dropped from the list rather than
 * raising a parse error; a hand-authored table with a broken row degrades to
 * a wrong `locations` list, not a thrown exception.
 */
export function readGlossary(): GlossaryEntry[] {
  const body = readFileSync(join(REPO_ROOT, 'docs/concepts.md'), 'utf8');

  return body
    .split(/^### /m)
    .slice(1)
    .map((section) => {
      const [heading, ...rest] = section.split('\n');
      const lines = rest.join('\n');
      return {
        term: heading.trim(),
        isRepoWideRule: lines.includes(REPO_WIDE_RULE_MARKER),
        locations: lines
          .split('\n')
          .filter((line) => line.startsWith('|'))
          .map((line) => line.split('|')[1].trim())
          // Drops the header row and the `| --- |` separator.
          .filter(
            (cell) => cell !== '' && !/^-+$/.test(cell) && cell !== 'Location',
          ),
      };
    });
}

/**
 * `files` is every numbered ADR on disk; `indexed` is every ADR the index
 * table links to. Both are bare filenames, sorted, so a mismatch reads as a
 * plain set difference in either direction.
 */
export function readAdrIndex(): { files: string[]; indexed: string[] } {
  const dir = join(REPO_ROOT, 'docs/adr');
  const files = readdirSync(dir)
    .filter((name) => /^\d{4}-.+\.md$/.test(name))
    .sort();

  const index = readFileSync(join(dir, 'README.md'), 'utf8');
  const indexed = [...index.matchAll(LINK)]
    .map((match) => match[2].trim())
    .filter((target) => /^\d{4}-.+\.md$/.test(target))
    .sort();

  return { files, indexed };
}
