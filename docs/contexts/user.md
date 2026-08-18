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

none

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
