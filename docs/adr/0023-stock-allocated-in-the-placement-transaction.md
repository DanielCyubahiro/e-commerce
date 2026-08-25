# 0023. Stock is allocated in the placement transaction through a unit of work

## Status

Accepted. Answers the trigger [0019](0019-commands-call-collaborators-directly.md)
named: a second bounded context needing to react.

## Context

Placing an order must not oversell. Catalogue owns `products.stock`
([0022](0022-contexts-integrate-through-published-ports.md)), the order lives
in ordering, and the two writes have to succeed or fail together: an order
without its stock decrement oversells, a decrement without its order strands
inventory. There is no unit of work in the codebase; [0013](0013-guarded-writes-never-rehydration.md)
rejected one because a single guarded statement needs none.

## Decision

A shared [`UnitOfWork`](../../src/shared/application/unit-of-work.ts) port
runs one Postgres transaction and hands an opaque `Transaction` to the
handler, which passes it to both ports. `StockAllocator.allocate` decrements
each product in one guarded statement (`UPDATE ... WHERE stock >= $qty
RETURNING ...`) on that transaction, requests sorted by product id so
concurrent orders lock rows in one sequence and cannot deadlock;
`OrderWriteRepository.place` inserts on the same transaction. A shortfall, a
domain rule failing after allocation, or a lost idempotency race throws
inside the unit of work and rolls the decrements back. Cancellation runs the
mirror image: save the cancelled aggregate and release the stock in one
transaction. Pay, ship, and deliver are single statements and take no unit of
work.

The interface is named for the intent, `allocate` and `release`, not the
mechanism. A hard decrement at placement is acceptable only because "paid" is
a recorded fact with no payment window; when a provider arrives, a reservation
table (soft hold at placement, decrement at capture, release on cancel or
timeout) slides in behind the same two methods.

## Alternatives considered

- **Ordering's adapter writes `products.stock` itself, in one method.**
  Rejected by 0022.
- **Allocate, then place, with compensation on failure and no unit of work.**
  Rejected: a crash between the two leaks a decrement nothing reclaims, and a
  direct decrement cannot self-heal the way a reservation with an expiry can.
- **A reservation model with domain events and a `pending` order state.**
  The textbook end state, deferred: it needs the outbox
  [0018](0018-mail-sent-inline-after-commit.md) declined, an expiry job, and
  a client that polls, for a payment window that does not exist yet.

## Consequences

- One-aggregate-per-transaction is bent knowingly, through an explicit unit
  of work the code shows, rather than hidden inside an adapter.
- Every handler spec that asserts "stock is unchanged after a failed
  placement" relies on `FakeUnitOfWork` restoring participants, which the
  unit-of-work contract holds to the same behaviour as the Drizzle adapter.
- `products_stock_non_negative` is the database's backstop behind the guard.
- A fork whose `allocate` processes requests in request order deadlocks under
  concurrent orders sharing products; ordering's fork notes say so.
- The line count and distinctness rules run before the allocator, through
  `Order.checkLineRequests`, so a request the domain will refuse locks no
  rows; the currency rule cannot, since it needs the allocation's snapshot,
  and a mixed-currency request is the one case that allocates and rolls back.
