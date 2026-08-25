# 0024. Aggregates with a lifecycle are reconstituted and saved under optimistic concurrency

## Status

Accepted. Narrows [0008](0008-update-replaces-without-rehydration.md) and
[0013](0013-guarded-writes-never-rehydration.md) to the data they were about;
leaves [0002](0002-read-write-split-without-rehydration.md) intact.

## Context

`Product` has no lifecycle: an update replaces every field, so 0008 could
avoid loading it. A credential or a token has no cross-field invariant, so
0013 could move it with one guarded statement and no aggregate at all. An
`Order` is neither: it has behaviour after creation (pay, ship, deliver,
cancel), a state machine those behaviours must respect, and totals and lines
that constrain each other. Guarded SQL transitions would leave the state
machine as a lookup table enforced in the adapter and tested through
Postgres; that is the anemic domain the DDD literature warns about, and it is
not what any reference `Order` aggregate looks like.

## Decision

[`Order`](../../src/ordering/domain/entities/order.entity.ts) is a rich
aggregate. `Order.place` creates it; `Order.reconstitute` is the persistence
factory, taking value objects so their rules re-run on the way back in;
`pay`, `ship`, `deliver`, and `cancel` move the status through
`OrderStatus.transitionTo` and throw on an illegal move. The write repository
returns the aggregate from `findById`, and `save` is one
`UPDATE orders SET ... version = version + 1 WHERE id = $id AND version =
$expected`: zero rows matched is `'conflict'`, surfaced as 409
`ORDER_CONFLICT`. Load-modify-save is a race only when the save has no guard;
with the version predicate it is the standard way to make an aggregate's
transition safe, and it is 0013's own mechanism applied to a version column.

## Alternatives considered

- **Guarded SQL transitions with the rule table in the domain** (`UPDATE ...
  WHERE status IN ($sources)`). Rejected: the rule and its enforcement split
  across two layers, the state machine cannot be unit-tested without a
  database, and cancellation still has to read the lines to release stock.
- **Event-sourced orders.** Rejected: a projection and replay subsystem for a
  lifecycle five states long; the mutable row plus per-transition timestamps
  is the cheap standard.

## Consequences

- The domain's 100% coverage floor now covers the whole state machine, every
  pair of the transition matrix, with no database.
- Queries still never rehydrate (0002); `findById` on the write port is the
  only construction path from storage, and only command handlers use it.
- Guarded single statements remain the right tool for counters and tokens:
  the stock allocator uses exactly that. The line is "reconstitute what has
  behaviour, guard what is a counter".
- A `version` column and a 409 the client must handle by reloading.
