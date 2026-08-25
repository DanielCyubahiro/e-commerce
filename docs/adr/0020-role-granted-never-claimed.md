# 0020. Role is granted by an operator, never claimed by a request

## Status

Accepted.

## Context

[ADR 0010](0010-one-user-aggregate-with-a-role.md) put `role` on `UserProfile`
and left it replaceable through `PUT /users/:id` like any other field,
explicitly calling that "harmless while nothing depends on it" and flagging
that the decision would need revisiting once a role gained behaviour. The
ordering context now adds staff-only transitions gated on `seller` through
[`RolesGuard`](../../src/shared/presentation/guards/roles.guard.ts). Once an
endpoint branches on the role, a role a caller can set on themselves is not
an authorization boundary, it is a caller-chosen bypass of one:
`POST /users` or `PUT /users/:id` sending `role: 'seller'` would let anyone
grant themselves staff access.

## Decision

`role` is removed from every domain input. `UserProfileInput` (and therefore
`RegisterUserDto` and `UpdateUserProfileDto`) no longer has the field, so
`forbidNonWhitelisted` turns a submitted one into a 400 rather than a
silently accepted or silently dropped value. `User.create` assigns
[`UserRole.customer`](../../src/identity/domain/value-objects/user-role.vo.ts)
itself; no input reaches that assignment. `role` moves off `UserProfile` and
onto `User` directly, so `PUT /users/:id`, which only ever replaces a
`UserProfile`, cannot touch it even structurally, not merely by a validation
rule that a future change could loosen. The only way a `seller` comes to
exist is the operator statement documented in the README,
`UPDATE users SET role = 'seller' WHERE email = ...`; no port, command, or
endpoint can produce one.

## Alternatives considered

- **An admin-gated "promote user" endpoint.** Rejected for now: there is no
  seed process or existing admin role that could grant the very first
  seller, and building one is a larger decision, who is trusted to grant a
  role, and how that trust is bootstrapped, than this task's removal. A
  narrow, explicitly-gated promotion endpoint is a reasonable future change
  once that story exists.
- **Keeping the field but discarding a submitted value.** Rejected, for the
  same reason [ADR 0014](0014-email-is-immutable-after-registration.md)
  rejected it for email: silently dropping a field a client sent is
  indistinguishable from a bug, and this codebase's convention is to reject
  an unknown field outright.
- **Keeping `role` on `UserProfile` and adding a runtime check that rejects a
  changed value.** Rejected: a request could still probe the check by
  observing whether it fires, and a runtime check duplicates a rule the type
  system can make impossible outright by removing the field.

## Consequences

- `UserProfileInput` describes nothing about role, so no DTO built from it
  can carry one without `forbidNonWhitelisted` answering 400.
- [ADR 0010](0010-one-user-aggregate-with-a-role.md)'s consequence that "a
  role is replaceable through `PUT /users/:id` like any other field" no
  longer holds; its enum-column and two-copies-of-the-role-list
  consequences are unaffected and still apply.
- There is no self-service or admin-endpoint path to `seller` yet. Granting
  one is manual, by design, until a future task defines who is trusted to
  grant it.
- Ordering's staff-only endpoints, gated on `seller`, are now gating
  something a caller cannot grant themselves.
