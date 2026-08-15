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

      // General correctness.
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-param-reassign': ['error', { props: true }],
      'no-console': 'error',

      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
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
              group: [
                '**/application/**',
                '**/infrastructure/**',
                '**/presentation/**',
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
    files: ['src/*/application/**/*.ts', 'src/shared/application/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // Bare variants (no trailing /**) are required alongside the
              // /** forms: no-restricted-imports matches import specifiers
              // with gitignore semantics, where a trailing /** does not match
              // the barrel path itself (e.g. '@/product/infrastructure'),
              // only paths nested under it.
              group: [
                '**/infrastructure/**',
                '**/infrastructure',
                '**/presentation/**',
                '**/presentation',
                '@/*/infrastructure/**',
                '@/*/infrastructure',
                '@/*/presentation/**',
                '@/*/presentation',
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
    files: ['src/*/infrastructure/**/*.ts', 'src/shared/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/presentation/**',
                '**/presentation',
                '@/*/presentation/**',
                '@/*/presentation',
              ],
              message:
                'Infrastructure implements application ports. It must not import presentation.',
            },
          ],
        },
      ],
    },
  },
);
