# 0010. One `User` aggregate carries a role

## Status

Accepted. Narrowed by [ADR 0020](0020-role-granted-never-claimed.md): a role
now has behaviour (ordering's staff transitions), so it is no longer
replaceable through `PUT /users/:id` and registration always creates a
customer.

## Context

Users are either customers or sellers. Neither role carries data or
behaviour the other lacks today: there is no orders context, no cart, and
products have no owner.

## Decision

One [`User`](../../src/identity/domain/entities/user.entity.ts) aggregate
carrying a [`UserRole`](../../src/identity/domain/value-objects/user-role.vo.ts)
value object, one `users` table, one `role` column of Postgres enum type
`user_role`. The closed set is a domain rule, so
[`UserRole.create`](../../src/identity/domain/value-objects/user-role.vo.ts) owns
it and a bad value surfaces as 422, while the enum column stops a writer that
bypasses the domain.

## Alternatives considered

- **Separate `Customer` and `Seller` aggregates.** Rejected: two aggregates
  with identical fields and no distinct invariants.
- **A base user plus role-specific profile tables.** Rejected: it pays for
  per-role fields that do not exist.
- **Two bounded contexts.** Rejected for the same reason at a larger scale.
- **`varchar` with the domain as sole guard.** Rejected: the database should
  arbitrate as it does for SKU uniqueness
  ([ADR 0003](0003-sku-uniqueness-arbitrated-by-the-database.md)).

## Consequences

- A role is replaceable through `PUT /users/:id` like any other field, which
  is harmless while nothing depends on it. Superseded by
  [ADR 0020](0020-role-granted-never-claimed.md) once ordering's staff
  transitions gave the role something to depend on it for.
- Two copies of the role list exist, in
  [`ROLES`](../../src/identity/domain/value-objects/user-role.vo.ts) and in the
  `user_role` pgEnum, and nothing enforces their agreement.
- The decision must be revisited when a role gains data or behaviour, in
  particular when sellers own products, since a seller holding a catalogue
  could then flip to customer.
