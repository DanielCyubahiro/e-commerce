# Architecture decisions

One file per decision, numbered in the order they were recorded. Format is
Nygard plus an Alternatives section, because the roads not taken are half the
value of a learning archive and Consequences absorbs them badly.

Sections: Status, Context, Decision, Alternatives considered, Consequences.
Known limitations go in Consequences rather than being omitted.

Records 0001 to 0007 were written retroactively, after the decisions had already
shipped. Everything from 0008 onward is written before or alongside the change.

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-money-as-integer-minor-units.md) | Money is an integer count of minor units | Accepted |
| [0002](0002-read-write-split-without-rehydration.md) | Queries project rows; they never rehydrate the aggregate | Accepted |
| [0003](0003-sku-uniqueness-arbitrated-by-the-database.md) | The unique constraint arbitrates duplicate SKUs | Accepted |
| [0004](0004-no-nest-aggregate-root-base-class.md) | `AggregateRoot` is empty, not Nest's | Accepted |
| [0005](0005-contract-tests-bind-to-every-adapter.md) | One contract suite runs against every implementation | Accepted |
| [0006](0006-validation-at-the-edge-versus-the-domain.md) | DTOs check shape; the domain owns rules | Accepted |
| [0007](0007-hard-delete-over-soft-delete.md) | Deleting a product removes the row | Accepted |
| [0008](0008-update-replaces-without-rehydration.md) | Updating a product replaces it, without rehydration | Accepted |
| [0009](0009-postgres-owns-updated-at.md) | Postgres owns `updated_at` | Accepted |
| [0010](0010-one-user-aggregate-with-a-role.md) | One `User` aggregate carries a role | Accepted |
| [0011](0011-absence-has-one-spelling.md) | Absence is `null` from the aggregate outward | Accepted |
| [0012](0012-contexts-are-named-for-capabilities.md) | Contexts are named for capabilities, not entities | Accepted |
| [0013](0013-guarded-writes-never-rehydration.md) | Auth state transitions are guarded writes, never rehydrated | Accepted |
| [0014](0014-email-is-immutable-after-registration.md) | Email is immutable after registration | Accepted |
| [0015](0015-authentication-without-authorization.md) | Authentication ships without authorization | Accepted |
| [0016](0016-refresh-rotation-with-reuse-detection.md) | Refresh tokens rotate with strict reuse detection | Accepted |
| [0017](0017-token-state-in-postgres.md) | Credential and token state lives in Postgres, not Mongo | Accepted |
| [0018](0018-mail-sent-inline-after-commit.md) | Mail is sent inline after commit, not through an outbox | Accepted |
| [0019](0019-commands-call-collaborators-directly.md) | Commands call collaborators directly; no domain events | Accepted |
