# 0024. Orders live in Postgres, not Mongo

## Status

Accepted. Closes the reservation [0017](0017-token-state-in-postgres.md) left
open.

## Context

ADR 0017 kept Mongo connected "for a future context whose data actually wants
a document shape". An order, nested lines and an embedded address, is the
textbook example. Ordering is that future context, so the question had to be
answered rather than deferred again.

## Decision

Orders are two relational tables, `orders` and `order_lines`, in the same
Postgres database as the catalogue. `MongoModule` stays connected with no
consumer, and `.env.example` keeps its comment.

## Alternatives considered

- **One Mongo document per order.** Rejected. The hard problem in ordering is
  allocating stock and recording the order as one atomic step, and
  `products.stock` lives in Postgres; Postgres and Mongo share no transaction
  boundary, the exact reason 0017 rejected splitting authentication state.
  An order is also nested but not schema-flexible: a fixed set of scalar
  columns per line, a fixed address, which is a parent and child table, not
  a variable document. And a second store doubles the integration test
  infrastructure for one context, while the repo's stated way to learn a new
  store is a fork (AGENTS.md), not mixed persistence in one tree.

## Consequences

- `orders` and `order_lines` sit beside `products` and can share its
  transaction; [0026](0026-stock-allocated-in-the-placement-transaction.md)
  depends on that.
- Mongo is now connected with no plausible consumer named anywhere. Removing
  `MongoModule` and its two environment variables is a small change nothing
  blocks; leaving it is honest as long as this record says so.
