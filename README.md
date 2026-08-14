# e-commerce

A NestJS learning project exploring DDD, CQRS, and hexagonal architecture. One
bounded context (`product`) sits on a shared kernel; customers and orders will
follow.

## Architecture

Dependencies point inward. ESLint enforces the boundaries, so a violation fails
the build rather than relying on discipline.

| Layer | Owns | May import |
| --- | --- | --- |
| `domain` | Aggregates, value objects, invariants | Nothing outside itself. No framework. |
| `application` | Commands, queries, handlers, ports | `domain` |
| `infrastructure` | Port implementations (Drizzle adapters) | `application`, `domain` |
| `presentation` | Controllers, DTOs, filters | `application` |

Commands operate on the `Product` aggregate. Queries never touch it; they project
rows into read models.

Each layer exposes a barrel (`index.ts`) as its public surface. Code inside a
layer imports by relative path, never through its own barrel: that cycle makes a
Nest injection token resolve to `undefined` and surfaces at boot as an unrelated
"can't resolve dependencies" error.

## Prerequisites

- Node 22+, pnpm, and Docker (Postgres and Mongo, plus integration tests)

## Setup

```bash
pnpm install
cp .env.example .env
pnpm db:up
```

Every variable in `.env.example` is required at boot. A missing or malformed one
aborts startup with a message naming it, rather than failing later on first
query.

## Scripts

| Script | Purpose |
| --- | --- |
| `pnpm start:dev` | Start databases, then watch mode |
| `pnpm start` | Run once against a running database |
| `pnpm build` | Compile to `dist` |
| `pnpm test` | Unit tests, no I/O |
| `pnpm test:integration` | Repository tests against a throwaway Postgres container |
| `pnpm test:http` | HTTP tests through the real pipe and filter stack |
| `pnpm test:all` | Every project |
| `pnpm test:cov` | Coverage |
| `pnpm lint` | ESLint with type-aware rules |
| `pnpm db:up` / `db:down` / `db:logs` | Local Postgres and Mongo |

## Testing layers

1. **Unit** (`src/**/*.spec.ts`) pure domain logic, no test doubles.
2. **Application** handlers against in-memory fakes rather than mocks. A mock
   asserts how a collaborator was called; a fake asserts what happened.
3. **Contract** (`test/contracts/`) one suite run twice, against the in-memory
   fake and against the Drizzle adapter, so the fake cannot silently drift from
   the real implementation.
4. **Integration** (`test/**/*.integration-spec.ts`) real Postgres via
   testcontainers, with the drizzle migrations applied, so each run also proves
   the migration folder still applies from empty.
5. **HTTP** (`test/**/*.http-spec.ts`) real validation and filters via
   `configureApp`, fake repositories, no database.

Assert thrown domain exceptions with `catchError` from `@test/support/catch-error`,
not `expect(fn).toThrow(SomeException)`: those exceptions have private
constructors so they can only be built through named factories, which Jest's
`toThrow` cannot accept.

## Conventions

- Money is never a decimal. `Money` holds an integer count of minor units;
  `fromDecimal` rejects more precision than the currency has rather than
  rounding it away.
- Value objects and aggregates validate their own invariants. DTOs check only
  type, presence, and absurd-size ceilings, so a rule is never written twice.
- Errors carry a stable `code`. Domain invariants map to 422, malformed
  identifiers to 400, conflicts to 409, and anything unrecognised to a generic
  500 that leaks no driver detail.
