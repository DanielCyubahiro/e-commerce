# 0014. Email is immutable after registration

## Status

Accepted.

## Context

Before this feature, `User` carried a `replace` constructor alongside
`create`, the same shape [ADR 0008](0008-update-replaces-without-rehydration.md)
gave `Product`: `PUT /users/:id` replaced every field, email included, in one
request with no partial form. Authentication now attaches state to a user's
email specifically: `credentials.email_verified_at` records that this address
was proven reachable, and every verification and reset token is issued to an
email looked up through
[`CredentialRepository.findAuthentication`](../../src/identity/application/ports/credential.repository.ts).
If email stayed replaceable, changing it would either have to carry the old
`email_verified_at` forward, silently claiming a new, unproven address was
verified, or reset it, but resetting it from inside a full-replace write path
that also happens to change a name or a phone number would tie an
unauthentication side effect to an endpoint whose primary purpose is
unrelated.

## Decision

[`UserProfile`](../../src/identity/domain/value-objects/user-profile.vo.ts)
is extracted from `User`, carrying every field allowed to change after
registration: both names, the role, and the phone. `User` keeps only its id,
its email, and its profile, and `User.create` is its only constructor;
`User.replace` no longer exists. `PUT /users/:id` now builds a `UserProfile`
through `UserProfile.create` and calls
[`UserWriteRepository.replaceProfile`](../../src/identity/application/ports/user.write-repository.ts),
whose `UPDATE` statement's `SET` list never names the `email` column, so this
path cannot raise `DuplicateEmailException` even in principle; only
`register` can.
[`UpdateUserProfileDto`](../../src/identity/presentation/dtos/update-user-profile.dto.ts)
has no `email` field to match, and the global `ValidationPipe`'s
`forbidNonWhitelisted` turns a client that submits one into a 400 rather than
silently discarding it.

Removing `replace` restores the property [ADR 0002](0002-read-write-split-without-rehydration.md)
originally relied on, that `create` is the only way into a `User`'s existence,
which [ADR 0008](0008-update-replaces-without-rehydration.md) had narrowed by
giving the aggregate a second, write-side constructor. That narrowing still
holds for `Product`, and for any future aggregate that adopts the same
replace-without-rehydration shape; ADR 0008's Consequences now record that
"replace" means every *mutable* field, not literally every field, once a
context has a field like email that must not be one of them.

## Alternatives considered

- **Resetting verification and revoking every session on an email change.**
  Rejected: a one-character typo in a legitimate correction would sign the
  user out everywhere and drop them back to unverified, a lockout that feels
  permanent from the account holder's side, since fixing it requires proving
  control of the corrected address all over again while already locked out
  of every session.
- **Silently ignoring a submitted `email` field.** Rejected: dropping a field
  a client explicitly sent, with no error, is indistinguishable from a bug,
  and `forbidNonWhitelisted` already establishes this codebase's convention
  of rejecting an unknown field outright rather than discarding it quietly.
- **Building a `pending_email` flow now**, storing a candidate address and
  mailing a confirmation link before swapping it in. Rejected for this
  feature: it needs a new token purpose, a new column, a new endpoint, and
  new mail copy, none of which any caller is asking for yet, and every other
  decision in this feature ships the capability that is needed now rather
  than one that might be.

## Consequences

- `User` has exactly one constructor and no code path, from inside the
  aggregate, that can change its email.
- `UserWriteRepository.replaceProfile` can never raise
  `DuplicateEmailException`; a duplicate check only exists on the `register`
  path, which is the only path that ever writes a new email.
- A user who registers with a typo'd email has no self-service correction
  today; the only remedy is a new registration and manual cleanup of the old
  row. That gap is acceptable for a learning backend and a real one to close
  before this pattern reaches production, most likely with the
  `pending_email` flow rejected above.
- [ADR 0008](0008-update-replaces-without-rehydration.md)'s "replace covers
  every field" is narrowed by this record: a context that adopts that shape
  may have a field, the way identity has email, that a replace must not
  touch.
