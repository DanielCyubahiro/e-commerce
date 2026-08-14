import type { Config } from 'jest';

const transform = {
  '^.+\\.(t|j)s$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
} satisfies Config['transform'];

const moduleNameMapper = {
  '^@/(.*)$': '<rootDir>/src/$1',
  '^@test/(.*)$': '<rootDir>/test/$1',
};

/**
 * Three test projects, separated by what they need rather than by what they
 * cover:
 *
 * - `unit` runs anywhere, no I/O.
 * - `integration` needs Docker; a container is provisioned once per run.
 * - `http` boots Nest with fake repositories, so it needs no database.
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
    },
    {
      displayName: 'integration',
      rootDir: '.',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/test/**/*.integration-spec.ts'],
      transform,
      moduleNameMapper,
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
};

export default config;
