# 0011. Absence is `null` from the aggregate outward

## Status

Accepted.

## Context

`phone` is the first optional field in the codebase. Absence can be spelled
four ways across the layers: an omitted JSON key, `undefined`, SQL `NULL`,
and an omitted response key.

## Decision

Absence is `null` from the aggregate outward.
[`UserProfile.create`](../../src/identity/domain/value-objects/user-profile.vo.ts)
collapses an omitted key, `undefined`, and `null` into `null`; the column is
nullable; the read model carries `string | null`; the response sends
`"phone": null`.

## Alternatives considered

- **`undefined` in the domain, `null` in the row.** Rejected: two spellings
  with a conversion at every crossing.
- **Omitting the key in the response.** Rejected: clients then cannot
  distinguish "no phone" from "this endpoint does not return phone", and the
  key set varies per row.
- **Making phone required.** Rejected: a data rule invented to dodge a
  representation question.

## Consequences

- [`UserProfileInput.phone`](../../src/identity/domain/value-objects/user-profile.vo.ts)
  is `?: string | null | undefined`, which looks permissive and is deliberate:
  it is the only place three spellings are tolerated, and
  `exactOptionalPropertyTypes` would otherwise force every caller to write
  `?? null`.
- The next optional field follows this rule rather than inventing a second
  one.
