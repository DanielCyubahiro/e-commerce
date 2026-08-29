# 0015. Authentication without authorization

## Status

Accepted. Narrowed by [0020](0020-server-side-sessions-replace-jwts.md):
`GET /auth/sessions` and `DELETE /auth/sessions/:id` are owner-scoped, the
first endpoints here that are. Everything this record says about `/users`
still holds. Narrowed again by [ADR 0023](0023-role-granted-never-claimed.md).

## Context

This feature adds authentication: proving who is asking, via `JwtAuthGuard`
and a valid access token. It adds no authorization: deciding what the asker
is allowed to do. `AccessClaims` carries a `role`, and its own comment says
directly that nothing branches on it yet, that it exists only so authorization
is additive later.
[`UserController`](../../src/identity/presentation/user.controller.ts)'s four
`:id` endpoints and its list endpoint check nothing about the caller beyond
"does a valid access token exist."

## Decision

Authentication ships without authorization, deliberately, as a distinct and
later concern. Any authenticated caller may read, replace the profile of, or
delete any user, not only their own row; `GET /users` lists every user in the
system to any authenticated caller, with no ownership filter and no role
check.

## Alternatives considered

- **A self-only ownership check**, comparing the access token's `userId`
  against the `:id` route parameter before allowing a read, write, or
  delete. Rejected for now: it would need to be threaded through every one
  of the five affected endpoints as its own piece of work, separable from
  "can we authenticate at all," and applying it to some endpoints but not
  others would be a worse, half-documented state than the current, fully
  documented one.
- **Inventing an admin role** to gate the destructive endpoints.
  Rejected: [`UserRole`](../../src/identity/domain/value-objects/user-role.vo.ts)
  is a business concept, `customer` or `seller`, unrelated to operator
  permissions, and bolting an admin concept onto it to gate three endpoints
  would be designing authorization backwards, from the first caller that
  happens to need it rather than from an actual policy.

## Consequences

- `AccessClaims.role` is issued into every access token today and read by
  nothing; it exists so a later authorization layer needs no token-shape
  change or forced re-issue of existing tokens to start using it.
- Every endpoint on `UserController` beyond `POST /users` is reachable by any
  registered, verified user against any user id, including one that is not
  their own; nothing in this API stops one account from reading or deleting
  another's.
- The gap is deliberate and documented rather than silent. This record, and
  the note beside identity's endpoint table in
  [`docs/contexts/identity.md`](../contexts/identity.md#endpoints), are what
  stop a future reader from mistaking it for an oversight.
- The next authorization work has an explicit decision to build against,
  rather than having to reconstruct from the code whether the current
  behaviour was intended.
