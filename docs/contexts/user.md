# User

The user context: one aggregate, no endpoints yet. Layer rules, the error
mechanism, and the generic fork procedure live in
[`docs/architecture.md`](../architecture.md); this file carries only what is
specific to `src/user/`.

## What it owns

[`User`](../../src/user/domain/entities/user.entity.ts) is the aggregate and
the whole consistency boundary. [`User.create`](../../src/user/domain/entities/user.entity.ts)
and [`User.replace`](../../src/user/domain/entities/user.entity.ts) are the
only ways to construct one, over one shared validation path:

- First and last name: 1 to 100 characters after trimming.
- Email: [`Email.create`](../../src/user/domain/value-objects/email.vo.ts)
  lowercases and bounds length to 254 characters.
- Role: [`UserRole.create`](../../src/user/domain/value-objects/user-role.vo.ts)
  accepts only `customer` or `seller`.
- Phone: [`Phone.create`](../../src/user/domain/value-objects/phone.vo.ts)
  normalises to E.164. Optional; absent means `null`.

## Endpoints

none

## Ports and adapters

Ports are declared in
[`src/user/application/ports/`](../../src/user/application/ports/). No
module binds them to an adapter yet; that lands in Task 6.

| Token | Interface | Adapter |
| --- | --- | --- |
| [`USER_READ_REPOSITORY`](../../src/user/application/ports/user.read-repository.ts) | `UserReadRepository` | [`DrizzleUserReadRepository`](../../src/user/infrastructure/adapters/drizzle-user.read-repository.ts) |
| [`USER_WRITE_REPOSITORY`](../../src/user/application/ports/user.write-repository.ts) | `UserWriteRepository` | [`DrizzleUserWriteRepository`](../../src/user/infrastructure/adapters/drizzle-user.write-repository.ts) |

Each port has one contract suite with two bindings, one per implementation. The
mechanism, and why a fake is held to the same suite as the adapter, is in
[`docs/testing.md`](../testing.md#the-contract-mechanism).

| Contract | Fake binding, `unit` | Adapter binding, `integration` |
| --- | --- | --- |
| [`userWriteRepositoryContract`](../../test/contracts/user-write-repository.contract.ts) | [`user-write-repository.spec.ts`](../../test/contracts/user-write-repository.spec.ts) | [`user-write-repository.integration-spec.ts`](../../test/contracts/user-write-repository.integration-spec.ts) |
| [`userReadRepositoryContract`](../../test/contracts/user-read-repository.contract.ts) | [`user-read-repository.spec.ts`](../../test/contracts/user-read-repository.spec.ts) | [`user-read-repository.integration-spec.ts`](../../test/contracts/user-read-repository.integration-spec.ts) |

Each fake binding constructs one in-memory repository:
[`InMemoryUserWriteRepository`](../../test/fakes/in-memory-user-write.repository.ts)
on the write side, and
[`InMemoryUserReadRepository`](../../test/fakes/in-memory-user-read.repository.ts)
on the read side, which projects from a write fake instance rather than
holding rows of its own. `reset` clears that write fake's row map and `close`
is a no-op, since neither fake acquires anything to release. Each adapter
binding reaches the same shared test Postgres connection; `reset` truncates
the `users` table between tests and `close` ends that connection.

Failure modes a fake cannot reproduce, such as the `users_set_updated_at`
trigger moving `updated_at` on a real `replace`, are covered outside the
shared contract in
[`drizzle-user-write.integration-spec.ts`](../../test/contracts/drizzle-user-write.integration-spec.ts).

## Request lifecycle

none

## Error codes

Codes raised by `src/user/`.

| Code | Kind | Status | Raised by |
| --- | --- | --- | --- |
| `USER_NAME_INVALID` | `invariant` | 422 | [`User`](../../src/user/domain/entities/user.entity.ts) |
| `USER_EMAIL_INVALID` | `invariant` | 422 | [`Email.create`](../../src/user/domain/value-objects/email.vo.ts) |
| `USER_PHONE_INVALID` | `invariant` | 422 | [`Phone.create`](../../src/user/domain/value-objects/phone.vo.ts) |
| `USER_ROLE_INVALID` | `invariant` | 422 | [`UserRole.create`](../../src/user/domain/value-objects/user-role.vo.ts) |
