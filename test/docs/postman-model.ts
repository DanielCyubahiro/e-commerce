import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './docs-model';

export const POSTMAN_DIR = 'postman';
const COLLECTION_SUFFIX = '.postman_collection.json';
const ENVIRONMENT_SUFFIX = '.postman_environment.json';

/** One request, wherever it sits. `happyPath` is true for top-level items only. */
export interface PostmanRequest {
  name: string;
  method: string;
  segments: string[];
  happyPath: boolean;
}

/**
 * One collection file. `root` is the filename minus its suffix, which the
 * naming rule ties to a `@Controller()` root. `references` is every variable
 * the file uses anywhere: `{{name}}` in URLs, headers and bodies, and
 * `pm.environment.get('name')` or `pm.collectionVariables.get('name')` in
 * any script at any level. Postman's `{{$dynamic}}` names are excluded.
 */
export interface Collection {
  file: string;
  root: string;
  variables: string[];
  references: string[];
  requests: PostmanRequest[];
}

type RawUrl = string | { raw?: string; path?: string[] } | undefined;

interface RawItem {
  name?: string;
  item?: RawItem[];
  request?: { method?: string; url?: RawUrl };
}

interface RawCollection {
  item?: RawItem[];
  variable?: { key?: string }[];
}

const MUSTACHE = /\{\{([^{}]+)\}\}/g;
const SCRIPT_GET = /pm\.(?:environment|collectionVariables)\.get\('([^']+)'\)/g;

/** Reads every `postman/*.postman_collection.json`, sorted by filename. */
export function readCollections(): Collection[] {
  return postmanFiles(COLLECTION_SUFFIX).map((name) => {
    const file = `${POSTMAN_DIR}/${name}`;
    const text = readFileSync(join(REPO_ROOT, file), 'utf8');
    const raw = JSON.parse(text) as RawCollection;

    return {
      file,
      root: name.slice(0, -COLLECTION_SUFFIX.length),
      variables: keysOf(raw.variable),
      references: referencesIn(text),
      requests: flatten(raw.item ?? [], true),
    };
  });
}

/** Reads the one environment file. Throws when there is not exactly one. */
export function readEnvironment(): { file: string; keys: string[] } {
  const names = postmanFiles(ENVIRONMENT_SUFFIX);
  const [name] = names;
  if (name === undefined || names.length !== 1) {
    throw new Error(
      `Expected exactly one ${ENVIRONMENT_SUFFIX} under ${POSTMAN_DIR}/, found ${names.length}.`,
    );
  }
  const file = `${POSTMAN_DIR}/${name}`;
  const raw = JSON.parse(readFileSync(join(REPO_ROOT, file), 'utf8')) as {
    values?: { key?: string }[];
  };

  return { file, keys: keysOf(raw.values) };
}

function postmanFiles(suffix: string): string[] {
  return readdirSync(join(REPO_ROOT, POSTMAN_DIR))
    .filter((name) => name.endsWith(suffix))
    .sort();
}

function keysOf(entries: { key?: string }[] | undefined): string[] {
  return (entries ?? []).flatMap((entry) =>
    typeof entry.key === 'string' ? [entry.key] : [],
  );
}

function flatten(items: RawItem[], topLevel: boolean): PostmanRequest[] {
  return items.flatMap((item) => {
    if (item.item) return flatten(item.item, false);
    const method = item.request?.method;
    if (method === undefined) return [];

    return [
      {
        name: item.name ?? '',
        method,
        segments: segmentsOf(item.request?.url),
        happyPath: topLevel,
      },
    ];
  });
}

function segmentsOf(url: RawUrl): string[] {
  if (url === undefined) return [];
  if (typeof url !== 'string' && Array.isArray(url.path)) {
    return url.path.filter((segment) => segment !== '');
  }
  // A raw URL here always starts with the host variable; drop it and the
  // query: `{{baseUrl}}/users?limit=20` is `['users']`.
  const raw = typeof url === 'string' ? url : (url.raw ?? '');
  return (raw.replace(/^\{\{[^}]+\}\}/, '').split('?')[0] ?? '')
    .split('/')
    .filter((segment) => segment !== '');
}

function referencesIn(text: string): string[] {
  const names = new Set<string>();
  for (const match of text.matchAll(MUSTACHE)) {
    const name = match[1];
    if (name !== undefined && !name.startsWith('$')) names.add(name);
  }
  for (const match of text.matchAll(SCRIPT_GET)) {
    const name = match[1];
    if (name !== undefined) names.add(name);
  }
  return [...names].sort();
}
