# 0025. Contexts integrate through published ports, never tables

## Status

Accepted.

## Context

Ordering needs two things from its neighbours: a product's stock decremented
with its name and price captured at that instant, and the identity of the
caller. Until now no context has needed anything from another, so nothing said
how two contexts may touch. The shortcut would have been ordering's adapter
writing `products.stock` directly: it is one method and one transaction.

## Decision

A context reaches a neighbour only through that neighbour's application
barrel, which is its published interface: ports, injection tokens, and outcome
types. Its domain, adapters, and controllers are private. Catalogue publishes
[`StockAllocator`](../../src/catalogue/application/ports/stock-allocator.ts)
and `CatalogueModule` exports the token; `OrderingModule` imports the module.
Identity publishes nothing to ordering: the caller's `userId` and `role`
arrive on the request from the authentication guard, and ordering models the
caller as its own
[`CustomerId`](../../src/ordering/domain/value-objects/customer-id.vo.ts).
`import/no-restricted-paths` in `eslint.config.mjs` enforces the rule for
every ordered pair of contexts.

## Alternatives considered

- **Ordering's adapter writes `products.stock`.** Rejected: the integration
  database anti-pattern. Catalogue could rename or retype the column and
  ordering would break with no compile error and no failing catalogue test,
  the same silent failure shape the fork notes already record for constraint
  names and triggers.
- **Domain events between the contexts.** Rejected for now, for the reasons in
  [0019](0019-commands-call-collaborators-directly.md): an in-process event
  discarded on a crash fails more quietly than a synchronous call that throws.
  [0026](0026-stock-allocated-in-the-placement-transaction.md) names the
  point at which events become worth their cost.

## Consequences

- Catalogue now has one consumer of one interface, and changing
  `StockAllocator` is a change to a published contract, visible in the
  contract suite and in ordering's handler specs.
- The lint rule is per pair of contexts and must be extended when a fourth
  context arrives.
