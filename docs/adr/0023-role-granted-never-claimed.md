# 0023. Role is granted by an operator, never claimed by a request

## Status

Accepted. Narrows [ADR 0010](0010-one-user-aggregate-with-a-role.md) and
[ADR 0015](0015-authentication-without-authorization.md).

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
- **Making role immutable only after registration**, the same shape
  [ADR 0014](0014-email-is-immutable-after-registration.md) gives email:
  keep `role` on `UserProfile`, accept it at registration, but never let
  `PUT /users/:id` touch it again. Rejected: that only closes the door on
  changing a role after creation, not on choosing one at creation; an
  attacker who wants `seller` would simply register a second account with
  `role: 'seller'` and never touch `PUT` at all.
- **Accepting the hole and documenting it**, the way this codebase already
  treats the account-existence oracle (see `docs/contexts/identity.md`'s
  "The 409 is not a bug to fix" paragraph). Rejected: that pattern fits a
  narrow, understood information leak, an unauthenticated caller learning
  an email is taken, not a capability grant; once an endpoint depends on
  the role, as ordering's staff transitions will, a self-granted role is
  privilege escalation, not disclosure, and documenting it would not make
  it safe to leave open.

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
- [ADR 0015](0015-authentication-without-authorization.md)'s authorization
  gap is narrowed, not closed: any authenticated caller can still read,
  replace the profile of, or delete any user through `/users`, including
  one that is not their own. What changed is negative only, no caller can
  grant themselves a role through that same surface, which is what makes
  ordering's staff transitions the first role-gated endpoints this codebase
  has.
