# Testing

This file is the test reference `AGENTS.md` and `README.md` point to: what the
five test layers are, how Jest is split into four projects, how a filename
routes a file to one of them, how the contract suite keeps a fake honest, and
why the coverage thresholds are shaped the way they are. Term definitions
(contract test, fake versus mock) live in
[`docs/concepts.md`](./concepts.md); this file covers the mechanism, not the
vocabulary.

## The five test layers

1. **Unit** (`src/**/*.spec.ts`) pure domain logic, no test doubles.
2. **Application** handlers against in-memory fakes rather than mocks. A fake
   asserts what happened; a mock asserts how a collaborator was called.
3. **Contract** (`test/contracts/`) one suite run twice, against the in-memory
   fake and against the Drizzle adapter, so the fake cannot silently drift
   from the real implementation.
4. **Integration** (`test/**/*.integration-spec.ts`) real Postgres via
   testcontainers, with the Drizzle migrations applied, so each run also
   proves the migration folder still applies from empty.
5. **HTTP** (`test/**/*.http-spec.ts`) real validation and filters via
   `configureApp`, fake repositories, no database.

Assert thrown domain exceptions with `catchError` (or its async counterpart
`catchRejection`) from
[`catch-error.ts`](../test/support/catch-error.ts), not
`expect(fn).toThrow(SomeException)`. Most domain exceptions
(`InvalidStockException`, `InvalidSkuException`,
`InvalidProductDescriptionException`, `InvalidProductNameException`,
`InvalidMoneyException`) are built only through a named factory behind a
private constructor, and that breaks `toThrow` at compile time, not runtime:
its type signature accepts a `Constructable`, which requires a public `new`,
so passing a class with a private constructor fails TypeScript with `TS2345`
before the test ever runs. At runtime `toThrow` never constructs anything
either way: it does a plain `instanceof` check. `InvalidIdentifierException`
is the one domain exception with a public constructor and no factory, so
`toThrow` would actually compile and pass against it, but `catchError` stays
the uniform pattern to reach for.

## Four Jest projects, not five

[`jest.config.ts`](../jest.config.ts) declares four projects, split by what a
test needs rather than by which of the five layers above it belongs to:

| Project | Needs | Layers it runs |
| --- | --- | --- |
| `unit` | Nothing, no I/O | Unit, Application, and the fake half of Contract |
| `integration` | Docker, one Postgres container per run, plus a Mailpit container for the SMTP email-sender binding | Integration, and the Drizzle and SMTP halves of Contract |
| `http` | Nothing, no database | HTTP |
| `docs` | Nothing, no database | The markdown tree, checked against `src/` |

Contract is the layer that splits across two projects: the same suite runs
once bound to the in-memory fake (in `unit`) and once bound to the Drizzle
adapter (in `integration`). See "The contract mechanism" below.

## The filename rule

`testMatch` decides which project claims a file, and the four patterns do
not overlap:

| Project | Pattern |
| --- | --- |
| `unit` | `src/**/*.spec.ts`, `test/**/*.spec.ts` |
| `integration` | `test/**/*.integration-spec.ts` |
| `http` | `test/**/*.http-spec.ts` |
| `docs` | `test/docs/**/*.docs-spec.ts` |

All four patterns are declared in [`testMatch`](../jest.config.ts).

The rule a reader needs is about the suffix, not the folder: `*.spec.ts`
requires a literal dot immediately before `spec.ts`. `foo.integration-spec.ts`
ends in `-spec.ts`, a hyphen where `unit`'s pattern requires a dot, so it never
matches `*.spec.ts` and stays invisible to `unit`. The same holds for
`*.http-spec.ts` and `*.docs-spec.ts`. That is also why `unit`'s pattern can
safely include `test/**/*.spec.ts` as well as `src/**/*.spec.ts`: a shared
contract suite's fake binding (for example
[`product-write-repository.spec.ts`](../test/contracts/product-write-repository.spec.ts))
lives under `test/` but still ends in plain `.spec.ts`, so `unit` picks it up
without also picking up its integration sibling. Confirmed empirically with
`npx jest --listTests --selectProjects <name>` for each of `unit`,
`integration`, `http`, and `docs`: zero files matched by more than one.

## Why integration runs serially

`integration`'s `testMatch` has no `maxWorkers` setting next to it in
[`jest.config.ts`](../jest.config.ts), because `maxWorkers` is a
top-level Jest option, not a per-project one: there is nowhere inside a single
project entry to say "run just this project's files one at a time." Serial
execution is instead enforced by the package script itself,
`"test:integration": "jest --selectProjects integration --runInBand"`, which
only ever runs that one project. All tests in that project share the one
Postgres container `globalSetup` provisions, so running them concurrently
would mean concurrent test cases racing over the same rows.

## The contract mechanism

A contract is a function that takes a name and a harness factory and declares
a `describe` block of behaviour every implementation of a port must satisfy.
No Jest project matches `*.contract.ts` directly; a binding file per
implementation imports the function and invokes it with a harness for that
implementation. Adding a case to the contract, or a method to the port,
breaks every binding at once until each implementation covers it, which is
what stops a fake from drifting away from the real adapter unnoticed. See
[Contract test](./concepts.md#contract-test) in the glossary for why this
counts as a contract test rather than an ordinary shared test helper, and
[ADR 0005](./adr/0005-contract-tests-bind-to-every-adapter.md) for why the
mechanism exists at all.

The email-sender contract's adapter binding starts its own Mailpit container
in a `beforeAll` rather than in the `integration` project's `globalSetup`
([`mailpit-container.ts`](../test/setup/mailpit-container.ts)): that binding is
the only test that needs Mailpit, and provisioning it globally would make
every other integration suite pay a second container's startup cost for a
dependency it never touches.

Harness shape follows what a contract's own port needs, not a shape every
contract shares. A write harness needs only one repository:

```ts
export interface WriteHarness {
  repository: ProductWriteRepository;
  reset(): Promise<void>;
  close(): Promise<void>;
}
```

([`WriteHarness`](../test/contracts/product-write-repository.contract.ts))

A read harness carries both ports, because seeding a row to read back goes
through the write port, and the context never assumes how a row reached
storage:

```ts
export interface ReadHarness {
  read: ProductReadRepository;
  write: ProductWriteRepository;
  reset(): Promise<void>;
  close(): Promise<void>;
}
```

([`ReadHarness`](../test/contracts/product-read-repository.contract.ts))

`reset` and `close` are requirements on any harness, not detail specific to
one binding. `reset` must leave the store as if no earlier test had run, so a
sibling test never observes a row a previous one left behind, whatever the
store backing `repository`, or `read` and `write`, actually is. `close`
releases whatever resource the harness acquired to reach that store, typically
a connection; a harness that acquired nothing may make `close` a no-op, but
every implementation still supplies both methods so a contract runs the same
way regardless of which one it is bound to.

Each context lists its own contracts and their two bindings under
`## Ports and adapters` on its page in [`docs/contexts/`](./contexts/).

Adding a new adapter and wiring it in through this same mechanism is a fork
operation; see the numbered procedure and its harness requirements in
[the fork seam](./architecture.md#fork-seam) rather than repeating it here.

## Why fakes, not mocks

See [Fake versus mock](./concepts.md#fake-versus-mock) for the definition.
The practical reason it matters here: a mock only proves a handler called the
port the way the test expected it to. A fake, backed by the contract suite
above, proves the handler's behaviour is correct against something that
actually stores and returns data the way the real adapter does. Application
handler tests only need to trust the fake once, at the contract level, rather
than re-deriving that trust in every handler spec.

## Why testcontainers, not a shared database

[`postgres-container.ts`](../test/setup/postgres-container.ts)
starts one throwaway Postgres container as Jest `globalSetup` for the
`integration` project and runs the Drizzle migrations against it before any
test executes; `postgres-container-teardown.ts` stops it after the run. Two
things a long-lived shared test database cannot give:

- **Isolation.** The container exists only for this one run. There is no
  database another branch, another developer, or a previous failed run could
  have left in a state this run has to account for; each test only has to
  handle the state `truncateAll` leaves behind between its own siblings.
- **A live check that migrations apply from empty.** Because the container
  starts with nothing and `globalSetup` runs every migration in
  [`drizzle/`](../drizzle/) to build the schema, a broken or missing migration
  fails the very first integration test, not a deploy. A shared database that
  already has the schema applied would never re-run that migration path and
  would not catch this.

## Coverage thresholds

[`coverageThreshold`](../jest.config.ts) in `jest.config.ts` is set
per layer rather than as one global number, because the layers do not have
the same excuse for gaps:

| Bucket | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| `src/**/domain/**/*.ts` | 100 | 100 | 100 | 100 |
| `src/**/application/**/*.ts` | 95 | 95 | 95 | 95 |
| `global` (everything else) | 85 | 80 | 85 | 85 |

`global` is not "the whole project"; Jest applies it to whatever
`collectCoverageFrom` matches that the two more specific globs above do not,
which in this codebase is infrastructure, presentation, and config.

The domain gets 100% because it is pure functions and value objects with no
I/O and no excuse for an untested branch. `global`'s branch floor is 80
rather than 85 for a reason specific to this codebase's use of
`emitDecoratorMetadata`: every decorator TypeScript sees causes it to emit a
conditional inside its own `__decorate` helper, one that has nothing to do
with the code a test could exercise. `ProductController` is the sharpest
example: it reports 100% statements and 75% branches, and all ten of its
uncovered branches sit on lines carrying a decorator (`@Body`, `@Res`,
`@Query`, `@Param`, and the constructor's own parameter types), never inside
a method body. Pushing the branch floor to 85 would mean writing tests
against compiler output rather than against this codebase's logic, so the
floor is set at 80, the number the controller (and the rest of the `global`
bucket, in aggregate) already clears.

`AGENTS.md`'s enforcement table names `jest.config.ts`, not this file, as the
mechanism for these four numbers. `jest.config.ts` itself already carries the
reasoning for 80 rather than 85 in a comment; this file is where that
reasoning is spelled out in full.
