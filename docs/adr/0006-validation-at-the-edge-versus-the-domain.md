# 0006. DTOs check shape; the domain owns rules

## Status

Accepted.

## Context

A request field can be invalid in two different ways: it can have the wrong
shape (missing, the wrong type, absurdly large), or it can violate a business
rule that only the domain understands (a malformed SKU, a negative stock
count, more decimal places than a currency has). A handler cannot safely act
on a value it cannot trust the shape of, so something has to reject the first
kind before a handler ever runs. See
[Invariant](../concepts.md#invariant) for how this codebase already records
that invariants are enforced once, on the aggregate or value object that owns
them, and never re-checked in a DTO.

## Decision

DTOs check only type, presence, and generous ceilings; value objects and
aggregates own every rule that expresses a business constraint.
[`ListProductsQueryDto`](../../src/product/presentation/dtos/list-products.query.dto.ts)
is the clearest example: its own comment states the boundary directly, that
pagination bounds (`limit`, `offset`) have no domain counterpart and so are
enforced here at the edge, while currency format does have one and is left
entirely to `Money`, surfacing as a 422 from the domain rather than a
DTO-level rejection, identically on both the create and the list path.
`@ValidateIf` makes `currency` required as soon as either `minPrice` or
`maxPrice` is set, which is itself an edge-only shape rule (a bound needs a
currency to mean anything), not something `Money` could enforce, since `Money`
never sees the two fields together.

## Alternatives considered

- **Validate everything in DTOs**, including business rules like SKU format or
  stock non-negativity. Rejected: the rule would then be written twice, once
  in the DTO's validators and once in the domain's own validation, with no
  mechanism forcing the two copies to stay in agreement as either one changes.
- **Validate nothing at the edge**, letting every value reach the domain
  unchecked. Rejected: without `@Type(() => Number)` and `@IsNumber()`,
  `?minPrice=abc` coerces silently to `NaN` and only fails later as a
  confusing 422 far from the actual mistake, and `?limit=abc` would reach
  pagination logic unchecked entirely, since pagination bounds have no domain
  rule to catch them at all.

## Consequences

- Pagination bounds are enforced at the edge because they have no domain
  counterpart to defer to; currency format is left entirely to `Money` and
  surfaces as 422 on both the create and the list path.
- Every rule exists in exactly one place, so there is exactly one place to
  change it and no risk of two copies disagreeing.
- This split leaves one known gap, deliberately unfixed. `ListProductsHandler`'s
  currency fallback is unreachable through HTTP only because
  `ListProductsQueryDto`'s `@ValidateIf` requires `currency` whenever a price
  bound is set. The underlying `ProductFilters` type still permits a bound with
  no currency, so a non-HTTP caller building a `ListProductsQuery` directly gets
  silent EUR conversion instead of a rejection. That is a consequence of the
  split recorded here, not a separate decision.
