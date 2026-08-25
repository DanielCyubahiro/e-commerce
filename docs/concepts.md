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

A context is named for the business capability it provides, never for an entity
it owns. `identity` rather than `user`, `catalogue` rather than `product`: an
entity-named context drifts toward being a CRUD wrapper around one table, and
the name stops describing what the context is for as soon as it owns a second
aggregate. The aggregate keeps the entity's name;
[`User`](../src/identity/domain/entities/user.entity.ts) still lives in
`identity`. Enforced by
[`context-naming.docs-spec.ts`](../test/docs/context-naming.docs-spec.ts),
which fails when a context directory shares a name with an entity it declares.

| Location | Instance | What's specific here |
| --- | --- | --- |
| catalogue | [`src/catalogue/`](../src/catalogue/) | owns one aggregate, `Product` |
| identity | [`src/identity/`](../src/identity/) | owns one aggregate, `User` |
| ordering | [`src/ordering/`](../src/ordering/) | the first context with a lifecycle aggregate; named for the capability, since `Order` is the entity |

Canonical source: Eric Evans, *Domain-Driven Design*, Part IV, "Strategic
Design".

### Aggregate

An aggregate is the whole consistency boundary: every invariant across its
objects is enforced on a single path into existence, so the constructor
stays private and the only way to obtain an instance is a static factory
that validates first.

| Location | Instance | What's specific here |
| --- | --- | --- |
| catalogue | [`Product`](../src/catalogue/domain/entities/product.entity.ts) | both `create` and `replace` validate through one path before an instance exists |
| identity | [`User`](../src/identity/domain/entities/user.entity.ts) | `create` is the only path; there is no `replace`, since email is immutable after registration and every mutable field lives on `UserProfile` instead (see [ADR 0014](./adr/0014-email-is-immutable-after-registration.md)); `role` lives on `User`, not on `UserProfile`, assigned as `customer` by `create` and changed by nobody through the API |
| ordering | [`Order`](../src/ordering/domain/entities/order.entity.ts) | `place` creates and owns the collection rules; `reconstitute` is the persistence factory, taking value objects so their rules re-run on the way back in; `pay`, `ship`, `deliver`, and `cancel` move the status through `OrderStatus.transitionTo` and stamp a timestamp. The first aggregate here with behaviour after creation |

Canonical source: Eric Evans, *Domain-Driven Design*, Ch. 6, "The Life Cycle
of a Domain Object".

### Aggregate root

An aggregate root marks which entity is an aggregate's single point of
entry; the pattern does not require it to carry any behaviour a plain entity
would not already have.

| Location | Instance | What's specific here |
| --- | --- | --- |
| shared | [`AggregateRoot`](../src/shared/domain/aggregate-root.base.ts) | stays empty on purpose; see [ADR 0004](./adr/0004-no-nest-aggregate-root-base-class.md) for why it does not extend Nest CQRS's own `AggregateRoot` |
| catalogue | [`Product`](../src/catalogue/domain/entities/product.entity.ts) | extends the empty `AggregateRoot` |
| identity | [`User`](../src/identity/domain/entities/user.entity.ts) | extends the empty `AggregateRoot` |
| ordering | [`Order`](../src/ordering/domain/entities/order.entity.ts) | extends the empty `AggregateRoot`; carries a `version` the repository guards on, never a domain event |

Canonical source: Vaughn Vernon, "Effective Aggregate Design" (a three part
paper).

### Entity

An entity's `equals` compares identity, not attributes, but this codebase's
definition also compares the constructor, so two entities that happen to
share an id but come from different classes still are not equal.

| Location | Instance | What's specific here |
| --- | --- | --- |
| shared | [`Entity`](../src/shared/domain/entity.base.ts) | the abstract base; every entity extends it directly or via `AggregateRoot` |
| catalogue | [`Product`](../src/catalogue/domain/entities/product.entity.ts) | inherits `equals` unmodified |
| identity | [`User`](../src/identity/domain/entities/user.entity.ts) | inherits `equals` unmodified |
| ordering | [`Order`](../src/ordering/domain/entities/order.entity.ts) | inherits `equals` unmodified; its lines are value objects, not child entities |

Canonical source: Eric Evans, *Domain-Driven Design*, Ch. 5, "A Model
Expressed in Software," section "Entities".

### Value object

Private constructor, named factory, normalisation at construction, comparison
by value through its own `equals`. A value object that also serves as identity
is still one; `ProductId` is that case.

| Location | Instance | What's specific here |
| --- | --- | --- |
| shared | [`Money`](../src/shared/domain/value-objects/money.vo.ts) | `fromDecimal` normalises decimals to minor units |
| catalogue | [`Sku`](../src/catalogue/domain/value-objects/sku.vo.ts) | `create` uppercases on construction |
| identity | [`Email`](../src/identity/domain/value-objects/email.vo.ts), [`Phone`](../src/identity/domain/value-objects/phone.vo.ts), [`UserRole`](../src/identity/domain/value-objects/user-role.vo.ts), [`UserId`](../src/identity/domain/value-objects/user-id.vo.ts), [`Password`](../src/identity/domain/value-objects/password.vo.ts), [`PasswordAttempt`](../src/identity/domain/value-objects/password.vo.ts), [`PasswordHash`](../src/identity/domain/value-objects/password-hash.vo.ts), [`SecretToken`](../src/identity/domain/value-objects/secret-token.vo.ts), [`TokenHash`](../src/identity/domain/value-objects/token-hash.vo.ts), [`TokenPurpose`](../src/identity/domain/value-objects/token-purpose.vo.ts), [`UserProfile`](../src/identity/domain/value-objects/user-profile.vo.ts), [`SessionId`](../src/identity/domain/value-objects/session-id.vo.ts), [`OneTimeTokenId`](../src/identity/domain/value-objects/one-time-token-id.vo.ts) | `Email` lowercases and bounds length, `Phone` normalises to a leading `+` and 8 to 15 digits (not E.164: country code and trunk prefix are not checked), `UserRole` closes the set to two values; `Password` enforces the 12-to-128 policy on a password being set, `PasswordAttempt` bounds only the ceiling, with no minimum, so a tightened policy cannot lock out a hash made under an older one; `PasswordHash` is the only shape a write port accepts, opaque to the algorithm that produced it; `SecretToken` pairs a plaintext with its digest so the two can never be confused, one leaves the process, the other is the only copy ever stored; `TokenHash` is the stored digest, a distinct type from `PasswordHash` even though both are strings at runtime; `TokenPurpose` closes which flow a one-time token belongs to, so a verification token cannot be presented to reset a password; `UserProfile` is everything about a user that can change after registration, email deliberately excluded; `SessionId` identifies one login, so revoking it is one write; `OneTimeTokenId` identifies one password-reset or email-verification token row |
| ordering | [`OrderId`](../src/ordering/domain/value-objects/order-id.vo.ts), [`CustomerId`](../src/ordering/domain/value-objects/customer-id.vo.ts), [`ProductRef`](../src/ordering/domain/value-objects/product-ref.vo.ts), [`Quantity`](../src/ordering/domain/value-objects/quantity.vo.ts), [`OrderStatus`](../src/ordering/domain/value-objects/order-status.vo.ts), [`ShippingAddress`](../src/ordering/domain/value-objects/shipping-address.vo.ts), [`OrderLineRequest`](../src/ordering/domain/value-objects/order-line-request.vo.ts), [`OrderLine`](../src/ordering/domain/value-objects/order-line.vo.ts) | `CustomerId` and `ProductRef` are ordering's own names for identity's user and catalogue's product; `Quantity` is the one rule that runs before stock is touched; `OrderStatus` owns the transition table as data; `ShippingAddress` folds four spellings of an absent optional field into `null`; `OrderLine` is a value object rather than an entity because a product appears on an order at most once |

Canonical source: Eric Evans, *Domain-Driven Design*, Ch. 5, "A Model
Expressed in Software," section "Value Objects".

### Invariant

Invariants are enforced once, on the aggregate or the value object that owns
them, and never re-checked in a DTO: a DTO bounds only type, presence, and a
size ceiling generous enough that the domain check is still the one that can
actually reject a value.

| Location | Instance | What's specific here |
| --- | --- | --- |
| catalogue | [`Product`](../src/catalogue/domain/entities/product.entity.ts) | owns the name, description, and stock invariants; neither [`CreateProductDto`](../src/catalogue/presentation/dtos/create-product.dto.ts) nor the update DTO repeats them |
| identity | [`UserProfile`](../src/identity/domain/value-objects/user-profile.vo.ts), [`Password`](../src/identity/domain/value-objects/password.vo.ts) | `UserProfile` owns the name invariant (moved off `User` when the profile was extracted, see [ADR 0014](./adr/0014-email-is-immutable-after-registration.md)); email, role, and phone invariants are owned by their own value objects; `Password` owns the 12-to-128 policy, separately from `PasswordAttempt`, which enforces no minimum |
| ordering | [`Quantity`](../src/ordering/domain/value-objects/quantity.vo.ts), [`OrderStatus`](../src/ordering/domain/value-objects/order-status.vo.ts), [`ShippingAddress`](../src/ordering/domain/value-objects/shipping-address.vo.ts) | each owns its rule; no DTO repeats one |

Canonical source: Eric Evans, *Domain-Driven Design* (invariants as part of
Aggregate consistency).

### Port

A port is a `Symbol` token paired with a TypeScript interface, both defined
in the application layer, and Nest injects by the token, never by a concrete
class.

| Location | Instance | What's specific here |
| --- | --- | --- |
| catalogue | [`PRODUCT_READ_REPOSITORY`](../src/catalogue/application/ports/product.read-repository.ts), [`PRODUCT_WRITE_REPOSITORY`](../src/catalogue/application/ports/product.write-repository.ts), [`STOCK_ALLOCATOR`](../src/catalogue/application/ports/stock-allocator.ts) | write's `add` throws `DuplicateSkuException` rather than pre-checking; `replace` returns false rather than throwing when no product holds the id; read's `findById` returns null on a miss; the allocator's `allocate` returns a closed outcome union and takes the caller's transaction |
| identity | [`USER_READ_REPOSITORY`](../src/identity/application/ports/user.read-repository.ts), [`USER_WRITE_REPOSITORY`](../src/identity/application/ports/user.write-repository.ts), [`PASSWORD_HASHER`](../src/identity/application/ports/password-hasher.ts), [`CREDENTIAL_REPOSITORY`](../src/identity/application/ports/credential.repository.ts), [`ONE_TIME_TOKEN_REPOSITORY`](../src/identity/application/ports/one-time-token.repository.ts), [`EMAIL_SENDER`](../src/identity/application/ports/email.sender.ts), [`SESSION_REPOSITORY`](../src/identity/application/ports/session.repository.ts) | write's `register` replaced `add`: it writes the user, its credential, and its first verification token in one transaction and throws `DuplicateEmailException` rather than pre-checking; `replaceProfile` replaced `replace`: it returns false rather than throwing when no user holds the id, and can never conflict on email, since email is not in its `SET` list; read's `findById` returns null on a miss; the session port's `touch` answers null for unknown, revoked and expired alike, and its `revoke` is owner-scoped in the predicate |
| ordering | none | Not modelled yet |

Canonical source: Alistair Cockburn's Hexagonal Architecture, also called
Ports and Adapters.

### Adapter

An adapter implements a port's interface in the infrastructure layer, and it
is the only place a driver-specific failure is allowed to become an
application exception; nothing above it should ever see a raw driver error.

| Location | Instance | What's specific here |
| --- | --- | --- |
| catalogue | [`DrizzleProductWriteRepository`](../src/catalogue/infrastructure/adapters/drizzle-product.write-repository.ts), [`DrizzleStockAllocator`](../src/catalogue/infrastructure/adapters/drizzle-stock-allocator.ts) | `isDuplicateSku` walks Drizzle's wrapped error cause chain to find the Postgres unique violation; `DrizzleStockAllocator` holds no database handle of its own, every statement runs on the transaction it is given |
| identity | [`DrizzleUserWriteRepository.isDuplicateEmail`](../src/identity/infrastructure/adapters/drizzle-user.write-repository.ts), [`Argon2PasswordHasher`](../src/identity/infrastructure/adapters/argon2-password.hasher.ts), [`DrizzleCredentialRepository`](../src/identity/infrastructure/adapters/drizzle-credential.repository.ts), [`DrizzleOneTimeTokenRepository`](../src/identity/infrastructure/adapters/drizzle-one-time-token.repository.ts), [`DrizzleSessionRepository`](../src/identity/infrastructure/adapters/drizzle-session.repository.ts), [`SmtpEmailSender`](../src/identity/infrastructure/adapters/smtp-email.sender.ts) | `DrizzleUserWriteRepository.isDuplicateEmail` walks the same wrapped error cause chain, matching both the `23505` code and the `users_email_unique` constraint name, so a primary-key collision is never misreported as a duplicate email; `Argon2PasswordHasher` is the only place argon2 is named; `DrizzleCredentialRepository`, `DrizzleOneTimeTokenRepository`, and `DrizzleSessionRepository` each write through one guarded statement rather than a read followed by a write (see [ADR 0013](./adr/0013-guarded-writes-never-rehydration.md)); `SmtpEmailSender` is the only place mail copy and link shapes exist |
| ordering | none | Not modelled yet |

Canonical source: Alistair Cockburn's Hexagonal Architecture, also called
Ports and Adapters.

### Command

A command is intent: a plain data holder with no behaviour of its own. Its
handler is the one that acts, and it returns only what a caller needs to
identify the result, never the aggregate itself.

| Location | Instance | What's specific here |
| --- | --- | --- |
| catalogue | [`CreateProductCommand`](../src/catalogue/application/use-cases/commands/create-product/create-product.command.ts), [`DeleteProductCommand`](../src/catalogue/application/use-cases/commands/delete-product/delete-product.command.ts), [`UpdateProductCommand`](../src/catalogue/application/use-cases/commands/update-product/update-product.command.ts) | `CreateProductCommand` carries `currency` last, mirroring the DTO's only optional field; `UpdateProductCommand` carries its six fields as one `ProductInput` object rather than positionally, because five of seven positional parameters would be strings |
| identity | [`RegisterUserCommand`](../src/identity/application/use-cases/commands/register-user/register-user.command.ts), [`DeleteUserCommand`](../src/identity/application/use-cases/commands/delete-user/delete-user.command.ts), [`UpdateUserCommand`](../src/identity/application/use-cases/commands/update-user/update-user.command.ts), [`LoginCommand`](../src/identity/application/use-cases/commands/login/login.command.ts), [`LogoutCommand`](../src/identity/application/use-cases/commands/logout/logout.command.ts), [`LogoutAllSessionsCommand`](../src/identity/application/use-cases/commands/logout-all-sessions/logout-all-sessions.command.ts), [`VerifyEmailCommand`](../src/identity/application/use-cases/commands/verify-email/verify-email.command.ts), [`ResendVerificationCommand`](../src/identity/application/use-cases/commands/resend-verification/resend-verification.command.ts), [`RequestPasswordResetCommand`](../src/identity/application/use-cases/commands/request-password-reset/request-password-reset.command.ts), [`ResetPasswordCommand`](../src/identity/application/use-cases/commands/reset-password/reset-password.command.ts), [`ChangePasswordCommand`](../src/identity/application/use-cases/commands/change-password/change-password.command.ts), [`AuthenticateSessionCommand`](../src/identity/application/use-cases/commands/authenticate-session/authenticate-session.command.ts), [`RevokeSessionCommand`](../src/identity/application/use-cases/commands/revoke-session/revoke-session.command.ts) | `RegisterUserCommand` carries its fields as one `UserInput` object and the raw password separately, since the handler is what puts the password through `Password.create`; `UpdateUserCommand` carries a `UserProfileInput`, not a `UserInput`, because neither email nor role is a field it can replace (see [ADR 0014](./adr/0014-email-is-immutable-after-registration.md)); every other command is a handful of raw strings, for example `AuthenticateSessionCommand`'s single presented token |
| ordering | none | Not modelled yet |

Canonical source: Martin Fowler, "CQRS" (bliki).

### Query

A query never touches the aggregate: it carries only the parameters a read
needs, and its handler asks a read repository for rows directly, with
nothing ever rehydrated into a domain object.

| Location | Instance | What's specific here |
| --- | --- | --- |
| catalogue | [`ListProductsQuery`](../src/catalogue/application/use-cases/queries/list-products/list-products.query.ts), [`GetProductQuery`](../src/catalogue/application/use-cases/queries/get-product/get-product.query.ts) | `ListProductsQuery` carries decimal price bounds; conversion to minor units happens only in the handler |
| identity | [`ListUsersQuery`](../src/identity/application/use-cases/queries/list-users/list-users.query.ts), [`GetUserQuery`](../src/identity/application/use-cases/queries/get-user/get-user.query.ts), [`ListSessionsQuery`](../src/identity/application/use-cases/queries/list-sessions/list-sessions.query.ts) | `ListUsersQuery` carries the role filter as the caller's raw string; parsing it through `UserRole` happens only in the handler; `ListSessionsQuery` carries the caller's own session id so the handler, not the repository, can mark which row is current |
| ordering | none | Not modelled yet |

Canonical source: Martin Fowler, "CQRS" (bliki).

### Handler

A handler binds a command or a query to a port, and it is the one layer
allowed to hold knowledge that only makes sense where two representations
meet, since presentation cannot import the domain and infrastructure has no
reason to know how a conversion works.

| Location | Instance | What's specific here |
| --- | --- | --- |
| catalogue | [`ListProductsHandler`](../src/catalogue/application/use-cases/queries/list-products/list-products.handler.ts) | the only layer entitled to know both a decimal price and its minor-unit form; see [ADR 0001](./adr/0001-money-as-integer-minor-units.md) |
| identity | [`ListUsersHandler`](../src/identity/application/use-cases/queries/list-users/list-users.handler.ts), [`RegisterUserHandler`](../src/identity/application/use-cases/commands/register-user/register-user.handler.ts), [`UpdateUserHandler`](../src/identity/application/use-cases/commands/update-user/update-user.handler.ts), [`LoginHandler`](../src/identity/application/use-cases/commands/login/login.handler.ts), [`LogoutHandler`](../src/identity/application/use-cases/commands/logout/logout.handler.ts), [`LogoutAllSessionsHandler`](../src/identity/application/use-cases/commands/logout-all-sessions/logout-all-sessions.handler.ts), [`VerifyEmailHandler`](../src/identity/application/use-cases/commands/verify-email/verify-email.handler.ts), [`ResendVerificationHandler`](../src/identity/application/use-cases/commands/resend-verification/resend-verification.handler.ts), [`RequestPasswordResetHandler`](../src/identity/application/use-cases/commands/request-password-reset/request-password-reset.handler.ts), [`ResetPasswordHandler`](../src/identity/application/use-cases/commands/reset-password/reset-password.handler.ts), [`ChangePasswordHandler`](../src/identity/application/use-cases/commands/change-password/change-password.handler.ts), [`AuthenticateSessionHandler`](../src/identity/application/use-cases/commands/authenticate-session/authenticate-session.handler.ts), [`RevokeSessionHandler`](../src/identity/application/use-cases/commands/revoke-session/revoke-session.handler.ts), [`ListSessionsHandler`](../src/identity/application/use-cases/queries/list-sessions/list-sessions.handler.ts) | `ListUsersHandler` is the only layer entitled to know both the wire string and the domain `UserRole` value; `VerifyEmailHandler` and `ResetPasswordHandler` are each the sole consumer of a closed-union outcome (`ConsumeOutcome`) dispatched through an exhaustive `switch`, so a member added to the union without a matching case is a compile error rather than a silent no-op; `RegisterUserHandler` is the only place a password is hashed before the aggregate it belongs to is even written; `AuthenticateSessionHandler` is the only handler that answers null instead of throwing, because its sole caller is the guard and 401 is the guard's decision |
| ordering | none | Not modelled yet |

Canonical source: Greg Young, "CQRS Documents".

### Read model

A read model is flat and carries no invariants: it is deliberately not the
aggregate, so the query path never needs to rehydrate one and the
aggregate's persistence factory can stay private.

| Location | Instance | What's specific here |
| --- | --- | --- |
| catalogue | [`ProductReadModel`](../src/catalogue/application/read-models/product.read-model.ts) | `priceMinorUnits` is the stored integer; presentation converts it to a decimal |
| identity | [`UserReadModel`](../src/identity/application/read-models/user.read-model.ts), [`SessionReadModel`](../src/identity/application/read-models/session.read-model.ts) | `phone` is `null`, never `undefined`, when the user has no phone, the one spelling of absence the aggregate itself carries; `SessionReadModel` never carries the token digest, the one column that must not leave the store |
| ordering | none | Not modelled yet |

Canonical source: Greg Young, "CQRS Documents".

### Projection

A projection turns a stored row into a read model, and it lives in the
adapter, so no other layer ever learns the row's shape.

| Location | Instance | What's specific here |
| --- | --- | --- |
| catalogue | [`DrizzleProductReadRepository.project`](../src/catalogue/infrastructure/adapters/drizzle-product.read-repository.ts) | renames the row's `priceAmount` column to `priceMinorUnits` |
| identity | [`DrizzleUserReadRepository.project`](../src/identity/infrastructure/adapters/drizzle-user.read-repository.ts) | passes every column through unrenamed; `phone` stays `null`, never `undefined` |
| ordering | none | Not modelled yet |

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
| catalogue | [`productWriteRepositoryContract`](../test/contracts/product-write-repository.contract.ts), [`productReadRepositoryContract`](../test/contracts/product-read-repository.contract.ts), [`stockAllocatorContract`](../test/contracts/stock-allocator.contract.ts) | each takes a `makeHarness` factory, so the same suite runs unmodified against any binding |
| identity | [`userWriteRepositoryContract`](../test/contracts/user-write-repository.contract.ts), [`userReadRepositoryContract`](../test/contracts/user-read-repository.contract.ts), [`passwordHasherContract`](../test/contracts/password-hasher.contract.ts), [`credentialRepositoryContract`](../test/contracts/credential-repository.contract.ts), [`oneTimeTokenRepositoryContract`](../test/contracts/one-time-token-repository.contract.ts), [`emailSenderContract`](../test/contracts/email-sender.contract.ts), [`sessionRepositoryContract`](../test/contracts/session-repository.contract.ts) | each takes a `makeHarness` factory, so the same suite runs unmodified against the in-memory (or recording) fake and the real adapter alike; seven suites, fourteen bindings in total |
| ordering | none | Not modelled yet |

Canonical source: Martin Fowler, "Contract Test" (bliki).

### Fake versus mock

A fake is a working implementation good enough for a test to assert on real
behaviour that actually happened; a mock instead asserts on how a
collaborator was called. A fake's fidelity to the real thing is never taken
on trust: a contract test (see "Contract test" above) is what would catch it
drifting.

| Location | Instance | What's specific here |
| --- | --- | --- |
| catalogue | [`InMemoryProductWriteRepository`](../test/fakes/in-memory-product-write.repository.ts), [`InMemoryStockAllocator`](../test/fakes/in-memory-stock-allocator.ts) | evidenced by a stored product being found by a later delete; the row also carries a create and a write sequence, which is how the fake reproduces the adapter's `updated_at` movement on replace rather than diverging from it silently; `InMemoryStockAllocator` decrements through the product fake's own `replace`, so it takes part in `FakeUnitOfWork` by way of the store it writes to |
| identity | [`InMemoryUserWriteRepository`](../test/fakes/in-memory-user-write.repository.ts), [`FakePasswordHasher`](../test/fakes/fake-password.hasher.ts), [`InMemoryCredentialRepository`](../test/fakes/in-memory-credential.repository.ts), [`InMemoryOneTimeTokenRepository`](../test/fakes/in-memory-one-time-token.repository.ts), [`InMemorySessionRepository`](../test/fakes/in-memory-session.repository.ts), [`RecordingEmailSender`](../test/fakes/recording-email.sender.ts) | `InMemoryUserWriteRepository` carries the same `createdSeq`/`updatedSeq` pair as product's fake, so it reproduces the trigger-driven `updated_at` movement the Drizzle adapter exhibits rather than diverging silently; `FakePasswordHasher` skips argon2 entirely, which is why the password-hasher contract exists, to keep it honest; `RecordingEmailSender` is a fake by this definition, not a mock, since tests assert on the messages it captured rather than on how it was called |
| ordering | none | Not modelled yet |

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
| catalogue | [`PRODUCT_SKU_INVALID`](../src/catalogue/domain/exceptions/invalid-sku.exception.ts) (invariant, 422) against [`PRODUCT_SKU_DUPLICATE`](../src/catalogue/application/exceptions/duplicate-sku.exception.ts) (conflict, 409) | contrasts a domain exception against an application exception |
| identity | [`USER_EMAIL_INVALID`](../src/identity/domain/exceptions/invalid-email.exception.ts) (invariant, 422) against [`USER_EMAIL_DUPLICATE`](../src/identity/application/exceptions/duplicate-email.exception.ts) (conflict, 409) | contrasts a domain exception against an application exception; malformed email shape and a store collision are never the same status. [`InvalidPasswordException`](../src/identity/domain/exceptions/invalid-password.exception.ts) (invariant, 422) against [`ForbiddenOriginException`](../src/identity/application/exceptions/forbidden-origin.exception.ts) (forbidden, 403) draws the same line for authentication: a password policy failure is checked by the `Password` value object itself and is a domain exception, while a request refused for where it came from is decided by the guard against configuration and is an application exception |
| ordering | [`ORDER_STATUS_INVALID`](../src/ordering/domain/exceptions/invalid-order-status.exception.ts) (invariant, 422) against [`ORDER_TRANSITION_ILLEGAL`](../src/ordering/domain/exceptions/illegal-order-transition.exception.ts) (illegal-transition, 409) | contrasts the two domain kinds: a status outside the set is malformed input, a move the table forbids is a state conflict, and the two never share a status code |

Canonical source: Eric Evans, *Domain-Driven Design* (invariants); on mapping
errors by architectural layer, Robert C. Martin, *Clean Architecture*.
