# Concepts

This file defines terms the way this codebase uses them, not the way a
textbook would. Each entry states the repo-specific fact, links to the code
that carries it, and names a canonical source for the general idea, which
that source explains better than a paraphrase here ever could. Structure and
layer rules live in `docs/architecture.md`; this file only defines
vocabulary.

### Bounded context

[`src/product/`](../src/product/) is the only bounded context in this
codebase today; [`src/shared/`](../src/shared/) is the kernel it sits on, not
a context of its own. Customers and orders, when they arrive, will sit
alongside `product/` as siblings, each behind its own domain, application,
infrastructure, and presentation layers. Canonical source: Eric Evans,
*Domain-Driven Design*, Part IV, "Strategic Design".

### Aggregate

[`Product`](../src/product/domain/entities/product.entity.ts) is the
aggregate, and it is the whole consistency boundary in this codebase:
[`Product.create`](../src/product/domain/entities/product.entity.ts#L50-L66)
is the only way to construct one, and it validates name, description, and
stock before an instance exists, so an invalid `Product` is never
representable. Canonical source: Eric Evans, *Domain-Driven Design*, Ch. 6,
"The Life Cycle of a Domain Object".

### Aggregate root

[`AggregateRoot`](../src/shared/domain/aggregate-root.base.ts#L4-L16) is
deliberately empty, a marker that adds nothing to `Entity`. See
[ADR 0004](./adr/0004-no-nest-aggregate-root-base-class.md) for why it does
not extend Nest CQRS's own `AggregateRoot` instead. Canonical source: Vaughn
Vernon, "Effective Aggregate Design" (a three part paper).

### Entity

[`Entity.equals`](../src/shared/domain/entity.base.ts#L10-L16) compares by id
and by constructor together, so a `Product` and a hypothetical `Order` that
happened to share a UUID would still not be equal. Canonical source: Eric
Evans, *Domain-Driven Design*, Ch. 5, "A Model Expressed in Software,"
section "Entities".

### Value object

`Money` and `Sku` are both value objects: each has a private constructor and
a named factory
([`Money.fromDecimal`](../src/shared/domain/value-objects/money.vo.ts),
[`Sku.create`](../src/product/domain/value-objects/sku.vo.ts)), each
normalises on construction (`Money` to minor units, `Sku` to uppercase), and
each compares by value through its own `equals`. Contrast `ProductId`, itself
a value object, but one that also serves as identity rather than a plain
attribute. Canonical source: Eric Evans, *Domain-Driven Design*, Ch. 5,
"A Model Expressed in Software," section "Value Objects".

### Invariant

Invariants are enforced once, on the aggregate or the value object that owns
them, and never re-checked in a DTO:
[`Product.validateName`, `validateDescription`, and
`validateStock`](../src/product/domain/entities/product.entity.ts#L68-L90)
run inside `create`, while
[`CreateProductDto`](../src/product/presentation/dtos/create-product.dto.ts)
checks only type, presence, and a generous size ceiling, so the same rule is
never written in two places that can drift apart. Canonical source: Eric
Evans, *Domain-Driven Design* (invariants as part of Aggregate consistency).

### Port

A port is a `Symbol` token paired with a TypeScript interface, both defined
in the application layer:
[`PRODUCT_READ_REPOSITORY`](../src/product/application/ports/product.read-repository.ts#L5)
and
[`PRODUCT_WRITE_REPOSITORY`](../src/product/application/ports/product.write-repository.ts#L3)
are what Nest injects by, never a concrete class. Canonical source: Alistair
Cockburn's Hexagonal Architecture, also called Ports and Adapters.

### Adapter

[`DrizzleProductWriteRepository`](../src/product/infrastructure/adapters/drizzle-product.write-repository.ts)
implements `ProductWriteRepository` in the infrastructure layer; its
`isDuplicateSku` check ([lines 49 to
78](../src/product/infrastructure/adapters/drizzle-product.write-repository.ts#L49-L78))
walks Drizzle's wrapped error cause chain to detect a Postgres unique
violation and maps it to `DuplicateSkuException`, an application exception,
rather than letting a driver error escape to the caller. Canonical source:
Alistair Cockburn's Hexagonal Architecture, also called Ports and Adapters.

### Command

[`CreateProductCommand`](../src/product/application/use-cases/commands/create-product/create-product.command.ts)
is intent: a plain data holder with no behaviour of its own. Its handler
mutates the `Product` aggregate and [returns only the new
id](../src/product/application/use-cases/commands/create-product/create-product.handler.ts#L33),
never the aggregate itself. Canonical source: Martin Fowler, "CQRS" (bliki).

### Query

[`ListProductsQuery`](../src/product/application/use-cases/queries/list-products/list-products.query.ts)
never touches the aggregate: it carries decimal price bounds and a
pagination request, and its handler asks a read repository for rows
directly, with no `Product` ever rehydrated. Canonical source: Martin
Fowler, "CQRS" (bliki).

### Handler

A handler binds a command or a query to a port.
[`ListProductsHandler`](../src/product/application/use-cases/queries/list-products/list-products.handler.ts#L13-L18)
is the only layer entitled to know both a decimal price and its minor-unit
form, since presentation cannot import the domain and infrastructure should
not need to know how the conversion works. See
[ADR 0001](./adr/0001-money-as-integer-minor-units.md) for why the stored form
is an integer count of minor units in the first place. Canonical source: Greg
Young, "CQRS Documents".

### Read model

[`ProductReadModel`](../src/product/application/read-models/product.read-model.ts)
is flat and carries no invariants; it is deliberately not the aggregate, so
the query path never rehydrates a `Product` and the aggregate's persistence
factory can stay private. `priceMinorUnits` is the stored integer;
converting it to a decimal is the presentation layer's job. See
[ADR 0002](./adr/0002-read-write-split-without-rehydration.md) for why the
read side is built this way. Canonical source: Greg Young, "CQRS Documents".

### Projection

[`DrizzleProductReadRepository.project`](../src/product/infrastructure/adapters/drizzle-product.read-repository.ts#L124-L136)
turns a Postgres row into a `ProductReadModel`, and it lives in the adapter,
so no other layer knows the row's shape. Canonical source: Greg Young, "CQRS
Documents".

### Dependency rule

Dependencies point inward only, and the four layers are ESLint-enforced
rather than left to discipline: an import that crosses the wrong way fails
`pnpm lint`. See [`docs/architecture.md`](./architecture.md) for the layer
table, the enforcement mechanism, and what each layer may import. Canonical
source: Robert C. Martin, *Clean Architecture*, Ch. 22, "The Clean
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
the two exception bases differ. Canonical source: Eric Evans, *Domain-Driven
Design* (Shared Kernel, Part IV).

### Contract test

[`productWriteRepositoryContract`](../test/contracts/product-write-repository.contract.ts#L14-L18)
is one suite, run once against
[`InMemoryProductWriteRepository`](../test/fakes/in-memory-product-write.repository.ts)
and once against the Drizzle adapter, so a divergence between the fake and
the real implementation is a test failure rather than a surprise later. See
"Fake versus mock" below for why the in-memory repository counts as a fake
rather than a mock. Canonical source: Martin Fowler, "Contract Test" (bliki).

### Fake versus mock

[`InMemoryProductWriteRepository`](../test/fakes/in-memory-product-write.repository.ts)
is a fake, not a mock: it asserts what actually happened, such as a stored
product being found by a later delete, while a mock would assert how a
collaborator was called. Its fidelity to the real adapter is not taken on
trust; the contract suite (see "Contract test" above) is what catches drift.
Canonical source: Martin Fowler, "Mocks Aren't Stubs".

### Domain versus application exception

`DomainErrorKind` has two values, and
[`STATUS_BY_KIND`](../src/shared/presentation/filters/domain-exception.filter.ts)
maps each to its own HTTP status: `invariant`, raised inside the aggregate
(for example by `Product.create`'s validation), to 422; `malformed-identifier`,
raised by
[`UniqueId.parse`](../src/shared/domain/value-objects/unique-id.vo.ts) via
`InvalidIdentifierException` when a string is not a UUID, to 400. Contrast
`ApplicationException`, filtered separately in
[`application-exception.filter.ts`](../src/shared/presentation/filters/application-exception.filter.ts),
whose `conflict` kind (a duplicate SKU) is filtered to 409 instead. Canonical
source: Eric Evans, *Domain-Driven Design* (invariants); on mapping errors by
architectural layer, Robert C. Martin, *Clean Architecture*.
