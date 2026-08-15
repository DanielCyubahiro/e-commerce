# Testing

This file is the test reference `AGENTS.md` and `README.md` point to: what the
five test layers are, how Jest is split into three projects, how a filename
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
[`test/support/catch-error.ts`](../test/support/catch-error.ts), not
`expect(fn).toThrow(SomeException)`. Those exceptions have private
constructors and are built only through named factories, and Jest's `toThrow`
cannot construct one to compare against.

## Three Jest projects, not five

[`jest.config.ts`](../jest.config.ts) declares three projects, split by what a
test needs rather than by which of the five layers above it belongs to:

| Project | Needs | Layers it runs |
| --- | --- | --- |
| `unit` | Nothing, no I/O | Unit, Application, and the fake half of Contract |
| `integration` | Docker, one Postgres container per run | Integration, and the Drizzle half of Contract |
| `http` | Nothing, no database | HTTP |

Contract is the layer that splits across two projects: the same suite runs
once bound to the in-memory fake (in `unit`) and once bound to the Drizzle
adapter (in `integration`). See "The contract mechanism" below.

## The filename rule

`testMatch` decides which project claims a file, and the three patterns do
not overlap:

| Project | Pattern | Source |
| --- | --- | --- |
| `unit` | `src/**/*.spec.ts`, `test/**/*.spec.ts` | [`jest.config.ts:38`](../jest.config.ts#L38) |
| `integration` | `test/**/*.integration-spec.ts` | [`jest.config.ts:47`](../jest.config.ts#L47) |
| `http` | `test/**/*.http-spec.ts` | [`jest.config.ts:58`](../jest.config.ts#L58) |

The rule a reader needs is about the suffix, not the folder: `*.spec.ts`
requires a literal dot immediately before `spec.ts`. `foo.integration-spec.ts`
ends in `-spec.ts`, a hyphen where `unit`'s pattern requires a dot, so it never
matches `*.spec.ts` and stays invisible to `unit`. The same holds for
`*.http-spec.ts`. That is also why `unit`'s pattern can safely include
`test/**/*.spec.ts` as well as `src/**/*.spec.ts`: a shared contract suite's
fake binding (for example
[`product-write-repository.spec.ts`](../test/contracts/product-write-repository.spec.ts))
lives under `test/` but still ends in plain `.spec.ts`, so `unit` picks it up
without also picking up its integration sibling. Confirmed empirically with
`npx jest --listTests --selectProjects <name>` for each of the three projects:
zero files matched by more than one.

## Why integration runs serially

`integration`'s `testMatch` has no `maxWorkers` setting next to it in
[`jest.config.ts`](../jest.config.ts#L24-L26), because `maxWorkers` is a
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
counts as a contract test rather than an ordinary shared test helper.

The two contracts do not share a harness shape. The write side needs only one
repository:

```ts
export interface WriteHarness {
  repository: ProductWriteRepository;
  reset(): Promise<void>;
  close(): Promise<void>;
}
```

([`product-write-repository.contract.ts:8-12`](../test/contracts/product-write-repository.contract.ts#L8-L12))

The read side needs both ports, because seeding a row to read back has to go
through the write port; the read contract never assumes how a row got into
storage:

```ts
export interface ReadHarness {
  read: ProductReadRepository;
  write: ProductWriteRepository;
  reset(): Promise<void>;
  close(): Promise<void>;
}
```

([`product-read-repository.contract.ts:9-15`](../test/contracts/product-read-repository.contract.ts#L9-L15))

Each contract has two bindings, one per implementation:

| Contract | Fake binding (`unit`) | Adapter binding (`integration`) |
| --- | --- | --- |
| Write | [`product-write-repository.spec.ts`](../test/contracts/product-write-repository.spec.ts) | [`product-write-repository.integration-spec.ts`](../test/contracts/product-write-repository.integration-spec.ts) |
| Read | [`product-read-repository.spec.ts`](../test/contracts/product-read-repository.spec.ts) | [`product-read-repository.integration-spec.ts`](../test/contracts/product-read-repository.integration-spec.ts) |

The fake bindings construct an
[`InMemoryProductWriteRepository`](../test/fakes/in-memory-product-write.repository.ts)
(and, for the read contract, an
[`InMemoryProductReadRepository`](../test/fakes/in-memory-product-read.repository.ts)
wrapping it) with `reset` clearing in-memory state. The adapter bindings
construct the Drizzle repositories against a real connection, with `reset`
truncating the table and `close` ending the connection. Adapter-only failure
modes that a fake has no way to reproduce, such as a column type rejecting a
value Postgres cannot store, are covered separately, outside the shared
contract; see
[`drizzle-product-write.integration-spec.ts`](../test/contracts/drizzle-product-write.integration-spec.ts)
for an example (an out-of-range stock value tripping a different Postgres
error code than a duplicate SKU).

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

[`test/setup/postgres-container.ts`](../test/setup/postgres-container.ts)
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

`coverageThreshold` in [`jest.config.ts`](../jest.config.ts#L82-L101) is set
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

`AGENTS.md` states these four numbers in one line and links here for why;
this file is where the reasoning behind the 80 rather than 85 lives.
