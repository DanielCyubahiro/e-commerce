import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT, readDocsModel } from './docs-model';

// The first exported class in a `*.entity.ts` file is that file's entity. A
// second exported class in the same file would be missed, which is acceptable:
// this checks a naming rule, not the file's structure.
const ENTITY_CLASS = /^export class (\w+)/m;

function entityNames(context: string): string[] {
  const dir = join(REPO_ROOT, 'src', context, 'domain', 'entities');

  if (!existsSync(dir)) {
    return [];
  }

  return readdirSync(dir)
    .filter((name) => name.endsWith('.entity.ts'))
    .flatMap((name) => {
      const captured = ENTITY_CLASS.exec(
        readFileSync(join(dir, name), 'utf8'),
      )?.[1];
      return captured ? [captured] : [];
    });
}

/**
 * Enforces the naming rule in docs/concepts.md's "Bounded context" entry: a
 * context is named for the business capability it provides, never for an
 * entity it happens to own. Catches the entity-named-context smell
 * mechanically, so the rule is not left to discipline.
 */
describe('bounded context naming', () => {
  const { contexts } = readDocsModel();

  it('finds at least one context, so an empty pass is impossible', () => {
    expect(contexts.length).toBeGreaterThan(0);
  });

  it.each(contexts)(
    '%s is named for a capability, not for an entity it owns',
    (context) => {
      const clashes = entityNames(context).filter(
        (entity) => entity.toLowerCase() === context.toLowerCase(),
      );

      expect(clashes).toEqual([]);
    },
  );
});
