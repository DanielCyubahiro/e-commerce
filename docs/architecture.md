# Architecture

This file describes structure and flow: the four layers, how a request moves
through them, how an error surfaces, and the procedure for forking the
infrastructure layer onto a different database or ORM. Term definitions
(aggregate, port, contract test, and so on) live in
[`docs/concepts.md`](./concepts.md); this file links to them rather than
redefining them.

## Layers and enforcement

Dependencies point inward. ESLint enforces the boundaries, so a violation
fails `pnpm lint` rather than relying on discipline. Nothing runs that
automatically today: there is no CI in this repo, so the check only happens
when someone runs the command.

| Layer | Owns | May import |
| --- | --- | --- |
| `domain` | Aggregates, value objects, invariants | Nothing outside itself. No framework. |
| `application` | Commands, queries, handlers, ports | `domain` |
| `infrastructure` | Port implementations (Drizzle adapters) | `application`, `domain` |
| `presentation` | Controllers, DTOs, filters | `application` |

Commands operate on a context's aggregate. Queries never touch it; they
project rows into read models.

Most layers expose a barrel (`index.ts`) as their public surface;
`src/catalogue/presentation/`, `src/shared/presentation/`, and
`src/shared/infrastructure/` do not yet have one. Code inside a layer that has
a barrel imports by relative path, never through its own barrel: that cycle
makes a Nest injection token resolve to `undefined` and surfaces at boot as an
unrelated "can't resolve dependencies" error.

Contexts are as bounded as layers. A context may import a neighbour only
through that neighbour's `application` barrel, which is its published
interface; its domain, adapters, and controllers are private. Catalogue
publishes `StockAllocator` this way and ordering consumes it; nothing else
crosses a context line. See [Published interface](./concepts.md#published-interface).

### Enforcement

[`eslint.config.mjs`](../eslint.config.mjs) carries four `no-restricted-imports`
blocks, one per layer that has something to forbid, plus the general
`import/no-cycle` rule that backs the barrel hazard above:

| Boundary | Enforced by |
| --- | --- |
| `domain` imports no `@nestjs/*` | `src/*/domain/**/*.ts` block, first pattern group |
| `domain` imports no `application`, `infrastructure`, or `presentation` | `src/*/domain/**/*.ts` block, second pattern group |
| `presentation` imports no domain entity, value object, or the domain barrel | `src/*/presentation/**/*.ts` block |
| `application` imports no `infrastructure` or `presentation` (no adapter, no controller) | `src/*/application/**/*.ts` block |
| `infrastructure` imports no `presentation` | `src/*/infrastructure/**/*.ts` block |
| a context imports another context only through its `application` barrel | `import/no-restricted-paths` zones in the base rules block, one per ordered pair of contexts and layer |

The presentation block has one deliberate carve-out: it names domain entities,
value objects, and the domain barrel specifically, not the domain layer as a
whole, so a direct import of a domain file that is none of those still
compiles. `src/shared/presentation/filters` relies on exactly that to import
`DomainException` and catch it.

## Request lifecycle

Every context follows the same pipeline: the global `ValidationPipe` runs
against a DTO, the controller dispatches a command or query on Nest CQRS's bus,
a handler calls a port, and an adapter reaches the database. Each context's own
diagram, with its endpoints and exceptions named, is on its page under
[`docs/contexts/`](./contexts/).

Validation splits across two places on purpose:
[`CreateProductDto`](../src/catalogue/presentation/dtos/create-product.dto.ts)
checks type, presence, and generous size ceilings, while
[`Product.create`](../src/catalogue/domain/entities/product.entity.ts)
owns the rules (name length, non-empty description, integer non-negative
stock), so a rule is never written twice. See
[Invariant](./concepts.md#invariant) in the glossary for how the two layers
divide that work in general.

The pipeline itself is described in two files, not one.
[`configureApp`](../src/app.config.ts) installs cookie parsing, CORS for the
one origin `WEB_BASE_URL` names (with credentials, never reflected), the
global `ValidationPipe`, and the three exception filters, and every context
relies on it for those. It takes that origin as a parameter because the
http-specs bootstrap it without `ConfigModule`; `main.ts` reads it from the
same `AUTH_WEB_SETTINGS` the guard uses.
Authentication's global guard is registered separately, as `APP_GUARD` in
[`identity.module.ts`](../src/identity/identity.module.ts), because a guard
handed to Nest's `useGlobalGuards` (which `configureApp` would have to call)
is constructed outside the DI container and cannot inject a port; `APP_GUARD`
is the one registration form Nest resolves through the container, so
[`SessionAuthGuard`](../src/identity/presentation/guards/session-auth.guard.ts)
can inject the `CommandBus` and `SessionCookie`. A request therefore passes
through the guard before it reaches `configureApp`'s pipe: guards run before
pipes, so a dead cookie on a protected endpoint answers 401 before a
malformed body could answer 400.

Authorization by role is a second guard,
[`RolesGuard`](../src/shared/presentation/guards/roles.guard.ts), applied
with `@UseGuards()` at method level wherever `@Roles()` lists roles, so it
always runs after the authentication guard has attached `request.user`.
Ownership is not a role and is not a guard: it is part of the command or
query, where the caller's id is part of the write.

## Error path

| Failure | Base | Filter | Status |
| --- | --- | --- | --- |
| Broken invariant | `DomainException`, kind `invariant` | `DomainExceptionFilter` | 422 |
| Malformed identifier | `DomainException`, kind `malformed-identifier` | `DomainExceptionFilter` | 400 |
| Illegal state transition, for example cancelling a shipped order | `DomainException`, kind `illegal-transition` | `DomainExceptionFilter` | 409 |
| Conflict, for example duplicate SKU | `ApplicationException`, kind `conflict` | `ApplicationExceptionFilter` | 409 |
| Not found | `ApplicationException`, kind `not-found` | `ApplicationExceptionFilter` | 404 |
| Conflict carrying structured detail, for example stock shortfalls | `ApplicationException`, kind `conflict`, with details | `ApplicationExceptionFilter` | 409, body gains details |
| Unauthenticated, or a bad credential or token | `ApplicationException`, kind `unauthorized` | `ApplicationExceptionFilter` | 401 |
| Authenticated but not permitted, for example an unverified email | `ApplicationException`, kind `forbidden` | `ApplicationExceptionFilter` | 403 |
| Anything unrecognised | none | `UnhandledExceptionFilter` | 500, no driver detail |

`DomainException` and `ApplicationException` both carry a stable,
machine-readable `code`, distinct from the status above.
`DomainExceptionFilter` and `ApplicationExceptionFilter` emit
`{ statusCode, code, message }`, where `code` is `exception.code`, and
`ApplicationExceptionFilter` adds `details` when the exception defines it,
as `StockUnavailableException` does.
Each context lists the codes it raises on its own page; see
[catalogue's](./contexts/catalogue.md#error-codes) for a worked set.
`UnhandledExceptionFilter` sets the same fixed code, `'INTERNAL_ERROR'`, only
for a genuinely unrecognised error. A framework exception, such as a
`ValidationPipe` rejection, takes a different branch of that same filter and
passes through with Nest's own `{ statusCode, message, error }` body and no
`code` at all, deliberately, so the pipe's per-field messages survive
unedited. A client branching on `code` has to treat that response shape as a
case of its own. A 429 from `ThrottlerGuard`, on the six endpoints identity
throttles, is a third case of the same shape: `ThrottlerException` also
extends `HttpException`, so it takes the same framework-exception branch,
with Nest's own `{ statusCode, message }` body and no `code`.

`STATUS_BY_KIND` in
[`domain-exception.filter.ts`](../src/shared/presentation/filters/domain-exception.filter.ts)
is typed `Record<DomainErrorKind, HttpStatus>`, and `DomainErrorKind` is the
closed union `'invariant' | 'malformed-identifier'`. A `Record` over a union
type requires every member as a key, so adding a third kind without extending
the map fails compilation rather than falling through at runtime.
`application-exception.filter.ts` repeats the same shape for
`ApplicationErrorKind`. `UnhandledExceptionFilter` is the backstop: it is
registered with a bare `@Catch()`, so anything the two typed filters do not
claim lands there, and it logs the real error while returning a generic body
with no table, column, or SQL fragment.

## Fork seam

Each context defines its own ports under `src/<context>/application/ports/`.
Everything above them, controllers, DTOs, command and query handlers, is
written against these interfaces and knows nothing about Drizzle or Postgres.
The ports a context actually has are listed under `## Ports and adapters` on
its page in [`docs/contexts/`](./contexts/); catalogue's are
[`ProductReadRepository`](../src/catalogue/application/ports/product.read-repository.ts)
and
[`ProductWriteRepository`](../src/catalogue/application/ports/product.write-repository.ts).
Forking this repo onto a different database or ORM touches more than the two
adapters. It also replaces the module that provides their client and closes it
on shutdown, and it leaves behind a handful of files that are Drizzle-specific
by construction, not incidentally.

`drizzle.config.ts`, the `drizzle/` directory (the generated `*.sql`
migrations and their `meta/` snapshots), and
[`products.schema.ts`](../src/shared/infrastructure/database/postgres/schema/products.schema.ts)
belong to Drizzle and drizzle-kit specifically. A fork that keeps Drizzle but
targets a different database engine still needs new migrations for that
engine. A fork that drops Drizzle for another ORM replaces all three outright
with that ORM's own schema definition and migration format. Migrations now
carry behaviour and not only structure, so `products.schema.ts` no longer
fully describes the database, and a fork that regenerates DDL from the schema
alone loses the `updated_at` trigger.

The procedure:

1. For each context, implement the ports listed under `## Ports and adapters`
   on its page in [`docs/contexts/`](./contexts/). Match each method's
   documented contract, not just its signature. Where an adapter detects a
   database constraint violation and maps it to an application exception, that
   detection is coupled to the constraint's *name*, which a different schema
   tool will not reproduce by accident. Each context page records its own
   couplings; catalogue's are in
   [Fork notes](./contexts/catalogue.md#fork-notes), and identity's,
   including two new to authentication, are in
   [Fork notes](./contexts/identity.md#fork-notes). Identity's five ports
   added by authentication, `PasswordHasher`, `CredentialRepository`,
   `OneTimeTokenRepository`, `SessionRepository`, and `EmailSender`, are the
   sharper case for matching the contract rather than the signature: a fork's
   `SessionRepository.touch` has to reproduce the guarded single-statement
   behaviour, not only return the same TypeScript shape. Ordering's ports and catalogue's
   `StockAllocator` are the sharpest cases for the contract rather than the
   signature: `allocate` has to keep its guarded per-row decrement and
   product id ordering, and `save` its version predicate, or the concurrency
   properties the contracts and adapter-only specs prove are lost.
2. Provide your new database client and give it a Nest injection token,
   following
   [`drizzle.provider.ts`](../src/shared/infrastructure/database/postgres/drizzle.provider.ts).
   It defines two providers: one factory for the raw client (`POSTGRES_CLIENT`)
   and one for the ORM handle built from it (`DRIZZLE`), kept separate so
   something still holds a reference capable of closing the connection. Your
   two new adapters will `@Inject` whatever token you create here, not
   `DRIZZLE`. The unit of work is a third provider from the same module:
   [`DrizzleUnitOfWork`](../src/shared/infrastructure/database/postgres/drizzle-unit-of-work.ts)
   wraps the client's transaction and hands adapters an opaque handle they
   unwrap with `asDrizzleTransaction`; a fork replaces both.
3. Wrap the new provider(s) in an `@Global()` module modelled on
   [`drizzle.module.ts`](../src/shared/infrastructure/database/postgres/drizzle.module.ts),
   implementing `OnModuleDestroy` to close the new client. That module states
   why the hook lives on the module rather than the provider: "factory
   providers cannot carry lifecycle hooks." Skip this step and the new
   connection leaks on shutdown instead of closing.
4. Import the new module in
   [`app.module.ts`](../src/app.module.ts), which is where `DrizzleModule`
   itself is wired in today, not `catalogue.module.ts`. `catalogue.module.ts`
   only binds ports to adapters; it has no visibility into what those adapters
   need injected, and it is not where the client comes from.
5. Register each context's adapters against its port tokens in that context's
   `<context>.module.ts`, replacing the `useClass` providers. No command or
   query handler needs to change.
6. Write one binding file per contract suite, per context. The harness shapes
   are in [`docs/testing.md`](./testing.md#the-contract-mechanism); the
   bindings each context already has are on its page.
7. Run `pnpm test:integration`.

The property that makes this safe: the contract suite is the port's
specification, not a suite that happens to exercise the Drizzle adapter. It
already runs twice, once against the in-memory fake and once against Drizzle,
and the in-memory fake is held to that exact same suite rather than trusted on
its own. An adapter that passes the same contract is substitutable by
construction; the rest of the codebase does not need to change, and nobody has
to re-derive correctness by reading the old adapter's code.
