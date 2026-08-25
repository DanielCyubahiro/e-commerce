# 0026. Order number and idempotency key live beside the aggregate, not in it

## Status

Accepted.

## Context

Two values every shop needs are not properties of an order in the domain's
sense. A human-readable order number exists for support desks and packing
slips; an idempotency key exists so a double-clicked "Place order" creates
one order, not two. Neither says anything about what an order is.

## Decision

`orders.number` is `bigint GENERATED ALWAYS AS IDENTITY`, assigned by the
database at insert, never on the aggregate, exposed on the read model and
rendered by presentation as `ORD-000123`; URLs stay keyed by the UUID. The
`Idempotency-Key` header is optional, a client-generated UUID, stored in
`orders.idempotency_key` with a unique index on `(customer_id,
idempotency_key)`; it travels on the command and the write port's `Placement`,
not on `Order`. A replay is answered from the pre-check with the original 201,
id, and `Location`; the unique index arbitrates the race the pre-check cannot
see, and the losing insert's transaction rolls back, allocation included.

## Alternatives considered

- **UUID only, no number.** Workable, but the consumers that want a number are
  the most likely next features, and adding it later means backfilling.
- **A random short code generated in the domain.** Hides volume, needs
  collision handling on insert; the swap if the sequence's leak ever matters.
- **A body fingerprint with the key** (Stripe's 422 on a mismatched replay).
  Deferred: it guards against a client bug rather than a double click and
  drags in canonical JSON hashing.

## Consequences

- A sequence leaks order volume to anyone who places two orders; accepted for
  a learning project.
- A replay with a different body returns the first order unchanged.
- `RESTART IDENTITY` in the test `truncateAll` is what makes the number
  predictable between tests.
