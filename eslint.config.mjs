// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['eslint.config.mjs', 'dist', 'coverage', 'drizzle'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: { import: importPlugin },
    settings: {
      'import/resolver': {
        typescript: { alwaysTryTypes: true },
      },
    },
    rules: {
      // Async correctness. no-misused-promises, await-thenable, and
      // require-await already come from recommendedTypeChecked.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',

      // Type safety: `value!` silences the compiler without proving anything.
      // Narrow instead, so the check and the use cannot drift apart.
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { fixStyle: 'inline-type-imports' },
      ],

      // Architecture: a cycle makes a Nest token resolve to undefined and
      // surfaces as an unrelated "can't resolve dependencies" error at boot.
      'import/no-cycle': ['error', { maxDepth: Infinity }],
      'import/no-self-import': 'error',

      // Architecture: a context reaches a neighbour only through that
      // neighbour's application barrel (ports, tokens, outcome types); its
      // domain, adapters, and controllers are private. `except` is relative
      // to `from`. A rule of its own rather than more `no-restricted-imports`
      // patterns because ESLint does not merge two configurations of one
      // rule: a per-context block would replace the per-layer block for
      // every file both matched. Zones target each context's four layer
      // directories rather than the context root, so a context's Nest module
      // file may still import a neighbour's module class, which is wiring,
      // not a layer dependency.
      'import/no-restricted-paths': [
        'error',
        {
          zones: ['ordering', 'catalogue', 'identity']
            .flatMap((target) =>
              ['ordering', 'catalogue', 'identity']
                .filter((from) => from !== target)
                .flatMap((from) =>
                  ['domain', 'application', 'infrastructure', 'presentation'].map(
                    (layer) => ({
                      target: `./src/${target}/${layer}`,
                      from: `./src/${from}`,
                      except: ['./application'],
                    }),
                  ),
                ),
            )
            .map((zone) => ({
              ...zone,
              message:
                'A context imports another context only through its application barrel (ports, tokens, outcome types).',
            })),
        },
      ],

      // General correctness.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-param-reassign': ['error', { props: true }],
      'no-console': 'error',

      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Repo scripts are ESM that node runs straight from source: no tsconfig
    // covers them, so the type-aware rules have no program to consult, and a
    // CLI's output is its whole interface.
    files: ['scripts/**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { sourceType: 'module' },
    rules: { 'no-console': 'off' },
  },
  {
    files: ['test/**/*.ts', 'src/**/*.spec.ts'],
    ...jestPlugin.configs['flat/recommended'],
    rules: {
      ...jestPlugin.configs['flat/recommended'].rules,
      // A committed `it.only` keeps CI green while running almost nothing.
      'jest/no-focused-tests': 'error',
      'jest/no-disabled-tests': 'error',
      'jest/no-conditional-expect': 'error',
      'jest/valid-expect': 'error',
      // supertest carries its own assertions, so `.expect(200)` counts.
      'jest/expect-expect': [
        'error',
        { assertFunctionNames: ['expect', 'request.**.expect'] },
      ],
    },
  },
  {
    // Contract suites are modules imported by two runners, not files jest
    // executes, so exporting from them is the point rather than a mistake.
    files: ['test/contracts/*.contract.ts'],
    rules: {
      'jest/no-export': 'off',
    },
  },
  {
    // Entities and value objects only: shared/presentation/filters legitimately
    // imports the domain exception base class in order to catch it.
    files: ['src/*/presentation/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/domain/entities/**',
                '**/domain/value-objects/**',
                '@/*/domain/entities/**',
                '@/*/domain/value-objects/**',
              ],
              message:
                'Presentation must not import domain entities or value objects. Consume read models through the application layer.',
            },
            {
              // The domain barrel re-exports entities and value objects
              // alongside exception base classes, so importing it whole
              // bypasses the group above. Match only the barrel path itself
              // (last segment "domain", or "domain/index" since
              // '@/catalogue/domain/index' resolves to the same file), so a
              // direct file import like '../../domain/domain-exception.base'
              // keeps working.
              regex: '(^|/)domain(/index)?$',
              message:
                'Presentation must not import the domain barrel; it re-exports entities and value objects. Import the specific domain file you need, or consume read models through the application layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/*/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@nestjs/*'],
              message:
                'The domain layer must not depend on a framework. Keep Nest in application, infrastructure, and presentation.',
            },
            {
              // Bare variants (no trailing /**) sit alongside every /** form
              // in this block and in the application and infrastructure
              // blocks below: no-restricted-imports matches specifiers with
              // gitignore semantics, where a trailing /** matches paths
              // nested under a directory but not a bare barrel import of the
              // directory itself (e.g. '@/catalogue/application').
              group: [
                '**/application/**',
                '**/application',
                '**/infrastructure/**',
                '**/infrastructure',
                '**/presentation/**',
                '**/presentation',
              ],
              message:
                'Dependencies point inward. The domain layer must not import an outer layer.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/*/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Bare variants for the same reason as the domain block above.
              group: [
                '**/infrastructure/**',
                '**/infrastructure',
                '**/presentation/**',
                '**/presentation',
              ],
              message:
                'Dependencies point inward. The application layer defines ports; it must not import an adapter or a controller.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/*/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Bare variants for the same reason as the domain block above.
              group: ['**/presentation/**', '**/presentation'],
              message:
                'Infrastructure implements application ports. It must not import presentation.',
            },
          ],
        },
      ],
    },
  },
);
