# Concepts

This file defines terms the way this codebase uses them, not the way a
textbook would. Each entry states the repo-specific fact, then an instance
table names where that fact shows up in each bounded context and links to
the code that carries it. `none` in a table cell means that context has no
instance of the term yet. A canonical source names the general idea, which
that source explains better than a paraphrase here ever could. Structure and
layer rules live in `docs/architecture.md`; this file only defines
vocabulary.

### Bounded context

A bounded context is a top-level directory under `src/` marked by having its
own `domain/` layer; application, infrastructure, and presentation typically
follow once that layer exists, but they are not what marks it as a context.
The shared kernel every context reuses (see "Shared kernel" below) is
deliberately excluded by name, even though it has a `domain/` layer of its
own too, because it holds no domain concept of its own, only what every
context needs.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`src/product/`](../src/product/) | owns one aggregate, `Product` |

Canonical source: Eric Evans, *Domain-Driven Design*, Part IV, "Strategic
Design".

### Aggregate

An aggregate is the whole consistency boundary: every invariant across its
objects is enforced on a single path into existence, so the constructor
stays private and the only way to obtain an instance is a static factory
that validates first.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`Product`](../src/product/domain/entities/product.entity.ts) | `create` validates name, description, and stock before an instance exists |

Canonical source: Eric Evans, *Domain-Driven Design*, Ch. 6, "The Life Cycle
of a Domain Object".

### Aggregate root

An aggregate root marks which entity is an aggregate's single point of
entry; the pattern does not require it to carry any behaviour a plain entity
would not already have.

| Location | Instance | What's specific here |
| --- | --- | --- |
| shared | [`AggregateRoot`](../src/shared/domain/aggregate-root.base.ts) | stays empty on purpose; see [ADR 0004](./adr/0004-no-nest-aggregate-root-base-class.md) for why it does not extend Nest CQRS's own `AggregateRoot` |
| product | [`Product`](../src/product/domain/entities/product.entity.ts) | extends the empty `AggregateRoot` |

Canonical source: Vaughn Vernon, "Effective Aggregate Design" (a three part
paper).

### Entity

An entity's `equals` compares identity, not attributes, but this codebase's
definition also compares the constructor, so two entities that happen to
share an id but come from different classes still are not equal.

| Location | Instance | What's specific here |
| --- | --- | --- |
| shared | [`Entity`](../src/shared/domain/entity.base.ts) | the abstract base; every entity extends it directly or via `AggregateRoot` |
| product | [`Product`](../src/product/domain/entities/product.entity.ts) | inherits `equals` unmodified |

Canonical source: Eric Evans, *Domain-Driven Design*, Ch. 5, "A Model
Expressed in Software," section "Entities".

### Value object

Private constructor, named factory, normalisation at construction, comparison
by value through its own `equals`. A value object that also serves as identity
is still one; `ProductId` is that case.

| Location | Instance | What's specific here |
| --- | --- | --- |
| shared | [`Money`](../src/shared/domain/value-objects/money.vo.ts) | `fromDecimal` normalises decimals to minor units |
| product | [`Sku`](../src/product/domain/value-objects/sku.vo.ts) | `create` uppercases on construction |

Canonical source: Eric Evans, *Domain-Driven Design*, Ch. 5, "A Model
Expressed in Software," section "Value Objects".

### Invariant

Invariants are enforced once, on the aggregate or the value object that owns
them, and never re-checked in a DTO: a DTO bounds only type, presence, and a
size ceiling generous enough that the domain check is still the one that can
actually reject a value.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`Product.create`](../src/product/domain/entities/product.entity.ts) | enforces the name, description, and stock invariants; [`CreateProductDto`](../src/product/presentation/dtos/create-product.dto.ts) deliberately does not repeat them |

Canonical source: Eric Evans, *Domain-Driven Design* (invariants as part of
Aggregate consistency).

### Port

A port is a `Symbol` token paired with a TypeScript interface, both defined
in the application layer, and Nest injects by the token, never by a concrete
class.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`PRODUCT_READ_REPOSITORY`](../src/product/application/ports/product.read-repository.ts), [`PRODUCT_WRITE_REPOSITORY`](../src/product/application/ports/product.write-repository.ts) | write's `add` throws `DuplicateSkuException` rather than pre-checking; read's `findById` returns null on a miss |

Canonical source: Alistair Cockburn's Hexagonal Architecture, also called
Ports and Adapters.

### Adapter

An adapter implements a port's interface in the infrastructure layer, and it
is the only place a driver-specific failure is allowed to become an
application exception; nothing above it should ever see a raw driver error.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`DrizzleProductWriteRepository`](../src/product/infrastructure/adapters/drizzle-product.write-repository.ts) | `isDuplicateSku` walks Drizzle's wrapped error cause chain to find the Postgres unique violation |

Canonical source: Alistair Cockburn's Hexagonal Architecture, also called
Ports and Adapters.

### Command

A command is intent: a plain data holder with no behaviour of its own. Its
handler is the one that acts, and it returns only what a caller needs to
identify the result, never the aggregate itself.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`CreateProductCommand`](../src/product/application/use-cases/commands/create-product/create-product.command.ts), [`DeleteProductCommand`](../src/product/application/use-cases/commands/delete-product/delete-product.command.ts) | `CreateProductCommand` carries `currency` last, mirroring the DTO's only optional field |

Canonical source: Martin Fowler, "CQRS" (bliki).

### Query

A query never touches the aggregate: it carries only the parameters a read
needs, and its handler asks a read repository for rows directly, with
nothing ever rehydrated into a domain object.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`ListProductsQuery`](../src/product/application/use-cases/queries/list-products/list-products.query.ts), [`GetProductQuery`](../src/product/application/use-cases/queries/get-product/get-product.query.ts) | `ListProductsQuery` carries decimal price bounds; conversion to minor units happens only in the handler |

Canonical source: Martin Fowler, "CQRS" (bliki).

### Handler

A handler binds a command or a query to a port, and it is the one layer
allowed to hold knowledge that only makes sense where two representations
meet, since presentation cannot import the domain and infrastructure has no
reason to know how a conversion works.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`ListProductsHandler`](../src/product/application/use-cases/queries/list-products/list-products.handler.ts) | the only layer entitled to know both a decimal price and its minor-unit form; see [ADR 0001](./adr/0001-money-as-integer-minor-units.md) |

Canonical source: Greg Young, "CQRS Documents".

### Read model

A read model is flat and carries no invariants: it is deliberately not the
aggregate, so the query path never needs to rehydrate one and the
aggregate's persistence factory can stay private.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`ProductReadModel`](../src/product/application/read-models/product.read-model.ts) | `priceMinorUnits` is the stored integer; presentation converts it to a decimal |

Canonical source: Greg Young, "CQRS Documents".

### Projection

A projection turns a stored row into a read model, and it lives in the
adapter, so no other layer ever learns the row's shape.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`DrizzleProductReadRepository.project`](../src/product/infrastructure/adapters/drizzle-product.read-repository.ts) | renames the row's `priceAmount` column to `priceMinorUnits` |

Canonical source: Greg Young, "CQRS Documents".

### Dependency rule

Dependencies point inward only, and the four layers are ESLint-enforced
rather than left to discipline: an import that crosses the wrong way fails
`pnpm lint`. See [`docs/architecture.md`](./architecture.md) for the layer
table, the enforcement mechanism, and what each layer may import.

**Repo-wide rule, no per-context instances.**

Canonical source: Robert C. Martin, *Clean Architecture*, Ch. 22, "The Clean
Architecture".

### Shared kernel

[`src/shared/`](../src/shared/) is the kernel every context reuses:
[`Entity`](../src/shared/domain/entity.base.ts),
[`AggregateRoot`](../src/shared/domain/aggregate-root.base.ts),
[`UniqueId`](../src/shared/domain/value-objects/unique-id.vo.ts), and
[`Money`](../src/shared/domain/value-objects/money.vo.ts) on the domain
side, [`DomainException`](../src/shared/domain/domain-exception.base.ts) and
[`ApplicationException`](../src/shared/application/application-exception.base.ts)
on the error side. See "Domain versus application exception" below for how
the two exception bases differ.

**Repo-wide rule, no per-context instances.**

Canonical source: Eric Evans, *Domain-Driven Design* (Shared Kernel, Part
IV).

### Contract test

A contract test is one suite, written once against a port's interface and
run against every implementation, fake and real alike, so a divergence
between them is a test failure rather than a surprise later.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`productWriteRepositoryContract`](../test/contracts/product-write-repository.contract.ts), [`productReadRepositoryContract`](../test/contracts/product-read-repository.contract.ts) | each takes a `makeHarness` factory, so the same suite runs unmodified against any binding |

Canonical source: Martin Fowler, "Contract Test" (bliki).

### Fake versus mock

A fake is a working implementation good enough for a test to assert on real
behaviour that actually happened; a mock instead asserts on how a
collaborator was called. A fake's fidelity to the real thing is never taken
on trust: a contract test (see "Contract test" above) is what would catch it
drifting.

| Location | Instance | What's specific here |
| --- | --- | --- |
| product | [`InMemoryProductWriteRepository`](../test/fakes/in-memory-product-write.repository.ts) | evidenced by a stored product being found by a later delete |

Canonical source: Martin Fowler, "Mocks Aren't Stubs".

### Domain versus application exception

A domain exception's `kind` decides its HTTP status through `STATUS_BY_KIND`:
`invariant`, raised inside an aggregate or value object, maps to 422;
`malformed-identifier`, raised when an identifier string fails to parse,
maps to 400. An application exception is caught by a separate filter with
its own kinds and its own statuses: `conflict` to 409, `not-found` to 404.
The two bases are never caught by the same filter, so a rule violated inside
the aggregate and a conflict discovered against other data never share a
status code by accident.

| Location | Instance | What's specific here |
| --- | --- | --- |
| shared | [`IDENTIFIER_INVALID`](../src/shared/domain/exceptions/invalid-identifier.exception.ts) (malformed-identifier, 400), [`MONEY_INVALID`](../src/shared/domain/exceptions/invalid-money.exception.ts) (invariant, 422) | contrasts the two domain-exception kinds against each other |
| product | [`PRODUCT_SKU_INVALID`](../src/product/domain/exceptions/invalid-sku.exception.ts) (invariant, 422) against [`PRODUCT_SKU_DUPLICATE`](../src/product/application/exceptions/duplicate-sku.exception.ts) (conflict, 409) | contrasts a domain exception against an application exception |

Canonical source: Eric Evans, *Domain-Driven Design* (invariants); on mapping
errors by architectural layer, Robert C. Martin, *Clean Architecture*.
