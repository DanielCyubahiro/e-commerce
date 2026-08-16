import type { Config } from 'jest';

const transform = {
  '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
} satisfies Config['transform'];

// class-transformer and class-validator read decorator metadata at runtime. Nest
// loads this itself, so only the bare unit tests would otherwise fail.
const setupFiles = ['reflect-metadata'];

const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@test/(.*)$': '<rootDir>/test/$1',
};

/**
 * Four test projects, separated by what they need rather than by what they
 * cover:
 *
 * - `unit` runs anywhere, no I/O.
 * - `integration` needs Docker; a container is provisioned once per run.
 * - `http` boots Nest with fake repositories, so it needs no database.
 * - `docs` reads the markdown tree and asserts it matches the code.
 *
 * Run one with `--selectProjects`, or see the package scripts. Integration must
 * run serially; that is enforced by `--runInBand` in the script, because
 * `maxWorkers` is a global option and cannot be set per project.
 */
const config: Config = {
  projects: [
    {
      displayName: 'unit',
      rootDir: '.',
      testEnvironment: 'node',
      // Also matches test/, so a shared contract suite can run against an
      // in-memory fake here and against Postgres in the integration project.
      // No overlap with the other projects: those end in `-spec.ts`, not
      // `.spec.ts`.
      testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
      transform,
      moduleNameMapper,
      setupFiles,
    },
    {
      displayName: 'integration',
      rootDir: '.',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/**/*.integration-spec.ts'],
      transform,
      moduleNameMapper,
      setupFiles,
      globalSetup: '<rootDir>/test/setup/postgres-container.ts',
      globalTeardown: '<rootDir>/test/setup/postgres-container-teardown.ts',
    },
    {
      displayName: 'http',
      rootDir: '.',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/**/*.http-spec.ts'],
      transform,
      moduleNameMapper,
      setupFiles,
    },
    {
      displayName: 'docs',
      rootDir: '.',
      testEnvironment: 'node',
      // Reads markdown and source files from disk, so it cannot live in `unit`,
      // which is documented as needing no I/O.
      testMatch: ['<rootDir>/test/docs/**/*.docs-spec.ts'],
      transform,
      moduleNameMapper,
      setupFiles,
    },
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/**/index.ts',
    '!src/main.ts',
    '!src/**/schema/**',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage',
  // Per layer rather than one global number: the domain is pure functions with no
  // excuse for gaps, while a provider factory needs a live connection to cover.
  //
  // `global` here means everything the globs below do not match, so it covers
  // infrastructure, presentation, and config only. Its branch floor is 80 rather
  // than 85 because with emitDecoratorMetadata every decorator emits a
  // conditional in TypeScript's __decorate helper: the controller reports 100%
  // statements and 75% branches, and all ten uncovered branches sit on decorator
  // lines. Reaching 85 would mean testing compiler output.
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 80,
      functions: 85,
      lines: 85,
    },
    'src/**/domain/**/*.ts': {
      statements: 100,
      branches: 100,
      functions: 100,
      lines: 100,
    },
    'src/**/application/**/*.ts': {
      statements: 95,
      branches: 95,
      functions: 95,
      lines: 95,
    },
  },
};

export default config;
