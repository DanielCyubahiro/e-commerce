#!/usr/bin/env node
/**
 * Publishes `postman/` to the Postman cloud. The repo is the source of
 * truth; the cloud copy is what the app runs. Conventions: postman/README.md.
 *
 * Usage: POSTMAN_API_KEY=... pnpm postman:push
 *
 * A collection file with no `info._postman_id` is created in the workspace
 * `POSTMAN_WORKSPACE_ID` names, then read back and rewritten with the ids
 * Postman assigned, so the next push updates it in place. That read-back is
 * the only write to disk this script ever does, and never to a file that
 * already has an id.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const API = 'https://api.getpostman.com';
const POSTMAN_DIR = fileURLToPath(new URL('../postman/', import.meta.url));
const COLLECTION_SUFFIX = '.postman_collection.json';
const ENVIRONMENT_SUFFIX = '.postman_environment.json';

// Added by the API on read, never meaningful on write, and they churn diffs.
const CLOUD_NOISE = new Set([
  'createdAt',
  'updatedAt',
  'lastUpdatedBy',
  'owner',
  'uid',
]);

/** Drops the fields the Postman API adds on read, at every depth. */
function stripCloudNoise(value) {
  if (Array.isArray(value)) {
    return value.map(stripCloudNoise);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !CLOUD_NOISE.has(key))
        .map(([key, inner]) => [key, stripCloudNoise(inner)]),
    );
  }
  return value;
}

/** The one on-disk shape: two-space JSON with a trailing newline. */
function serialize(json) {
  return `${JSON.stringify(json, null, 2)}\n`;
}

async function call(apiKey, method, path, body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} answered ${response.status}\n${text}`);
  }
  return { status: response.status, json: JSON.parse(text) };
}

async function pushCollection(apiKey, workspaceId, file) {
  const collection = JSON.parse(await readFile(file, 'utf8'));
  const id = collection.info?._postman_id;

  if (id) {
    const { status } = await call(apiKey, 'PUT', `/collections/${id}`, {
      collection,
    });
    return `${status} PUT  ${basename(file)}  ${collection.info.name}`;
  }

  if (!workspaceId) {
    throw new Error(
      `${basename(file)} has no info._postman_id. Export POSTMAN_WORKSPACE_ID to create it.`,
    );
  }
  const created = await call(
    apiKey,
    'POST',
    `/collections?workspace=${workspaceId}`,
    { collection },
  );
  const fresh = await call(
    apiKey,
    'GET',
    `/collections/${created.json.collection.id}`,
  );
  await writeFile(file, serialize(stripCloudNoise(fresh.json.collection)));
  return `${created.status} POST ${basename(file)}  ${collection.info.name}  (rewritten with cloud ids)`;
}

async function pushEnvironment(apiKey, file) {
  const { id, name, values } = JSON.parse(await readFile(file, 'utf8'));
  const { status } = await call(apiKey, 'PUT', `/environments/${id}`, {
    environment: { name, values },
  });
  return `${status} PUT  ${basename(file)}  ${name}`;
}

async function main() {
  const apiKey = process.env.POSTMAN_API_KEY;
  if (!apiKey) {
    console.error(
      'POSTMAN_API_KEY is not set. Create a key at https://postman.co/settings/me/api-keys and export it in your shell, not in .env.',
    );
    process.exit(1);
  }
  const workspaceId = process.env.POSTMAN_WORKSPACE_ID;
  const names = (await readdir(POSTMAN_DIR)).sort();

  for (const name of names.filter((n) => n.endsWith(COLLECTION_SUFFIX))) {
    console.log(
      await pushCollection(apiKey, workspaceId, join(POSTMAN_DIR, name)),
    );
  }
  for (const name of names.filter((n) => n.endsWith(ENVIRONMENT_SUFFIX))) {
    console.log(await pushEnvironment(apiKey, join(POSTMAN_DIR, name)));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
