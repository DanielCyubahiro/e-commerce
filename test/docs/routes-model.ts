// Brings the `Reflect.getMetadata` typings; Jest's setupFiles load the
// runtime, the type-aware lint needs the declaration.
import 'reflect-metadata';
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RequestMethod } from '@nestjs/common';
// A deep import into a compiled file, not a documented public path: a Nest
// upgrade can move or rename this without a deprecation notice.
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { REPO_ROOT } from './docs-model';

/** One route as Nest serves it. `segments` never contains an empty entry. */
export interface Route {
  root: string;
  method: string;
  segments: string[];
  file: string;
}

/**
 * Reads the routes off the controllers' own decorator metadata, the same
 * keys Nest's router reads, so this cannot disagree with what the app
 * serves. Imports every `src/<context>/presentation/*.controller.ts`; each
 * must export its controller class, and discovery requires the file's
 * parent directory to be named `presentation`. Sorted by file, then
 * declaration order.
 *
 * Limits: a `@Controller()` root must be a single string; an array root
 * (`@Controller(['a', 'b'])`) is skipped entirely. A bare `@Controller()`
 * with no argument yields root `/`, which no filename under the naming rule
 * can satisfy. Only handlers on the class's own prototype are read;
 * handlers inherited from a base class are invisible here.
 */
export function readRoutes(): Route[] {
  return controllerFiles().flatMap((file) => {
    // Jest transforms `require` through ts-jest; a native `import()` here
    // would need --experimental-vm-modules.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const exported: unknown = require(join(REPO_ROOT, file));
    if (typeof exported !== 'object' || exported === null) return [];

    return Object.values(exported as Record<string, unknown>).flatMap(
      (candidate) => routesOf(candidate, file),
    );
  });
}

function routesOf(candidate: unknown, file: string): Route[] {
  if (typeof candidate !== 'function') return [];
  const root: unknown = Reflect.getMetadata(PATH_METADATA, candidate);
  if (typeof root !== 'string') return [];
  const prototype: unknown = candidate.prototype;
  if (typeof prototype !== 'object' || prototype === null) return [];

  return Object.getOwnPropertyNames(prototype).flatMap((name) => {
    const handler: unknown = (prototype as Record<string, unknown>)[name];
    if (typeof handler !== 'function') return [];
    const method: unknown = Reflect.getMetadata(METHOD_METADATA, handler);
    if (typeof method !== 'number') return [];
    const path: unknown = Reflect.getMetadata(PATH_METADATA, handler);

    return [
      {
        root,
        method: RequestMethod[method],
        segments: `${root}/${typeof path === 'string' ? path : ''}`
          .split('/')
          .filter((segment) => segment !== ''),
        file,
      },
    ];
  });
}

function controllerFiles(): string[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        entry.name.endsWith('.controller.ts') &&
        dir.endsWith('presentation')
      ) {
        found.push(relative(REPO_ROOT, full));
      }
    }
  };
  walk(join(REPO_ROOT, 'src'));
  return found.sort();
}
