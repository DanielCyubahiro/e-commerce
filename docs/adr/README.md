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
| [0009](0009-postgres-owns-updated-at.md) | Postgres owns `updated_at` | Accepted |
