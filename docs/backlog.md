# Backlog

Two design gaps, found while writing the docs above and deliberately left
unfixed here. Each already has a failing case that would make a red test if
someone picks it up; this file exists so that work happens as its own
red-green-refactor cycle, not folded silently into an unrelated change.

## Entry 1: unreachable currency fallback

**Problem.** `ListProductsHandler.toMinorUnits`'s inner `convert` helper
defaults an unset currency to `'EUR'`:

```ts
Money.fromDecimal(amount, currency ?? 'EUR').minorUnits
```

([`list-products.handler.ts:43`](../src/product/application/use-cases/queries/list-products/list-products.handler.ts#L43))

Through HTTP this branch cannot run. `ListProductsQueryDto`'s `@ValidateIf`
makes `currency` required as soon as either `minPrice` or `maxPrice` is set
([`list-products.query.dto.ts:38-44`](../src/product/presentation/dtos/list-products.query.dto.ts#L38-L44)),
so a request that reaches the handler with a bound but no currency is already
a 400 the pipe rejected before any handler code runs. But the type the
fallback is guarding, `ProductFilters`, permits exactly that combination:
`minPriceMinorUnits`, `maxPriceMinorUnits`, and `currency` are three
independently optional fields
([`product.read-repository.ts:14-18`](../src/product/application/ports/product.read-repository.ts#L14-L18)),
and `ListProductsQuery.filters`, which `toMinorUnits` reads from, repeats the
same shape
([`list-products.query.ts:6-10`](../src/product/application/use-cases/queries/list-products/list-products.query.ts#L6-L10)).
The invariant that a price bound only means something within one currency is
written as a comment on `ProductFilters` and enforced only in the DTO. A
caller that builds a `ListProductsQuery` directly, bypassing HTTP entirely
(a different presentation layer, an internal service call, a future test),
can supply a bound with no currency and silently get EUR conversion instead
of a rejection.

**Why deferred.** No path in the running application reaches this branch
today; the only caller is HTTP, and the DTO already closes the gap for it.
Fixing it now would mean redesigning `ProductFilters` and the query's filter
shape without a failing test driving the change, which is exactly the
temptation `docs/testing.md`'s red-first rule exists to catch.

**Fix sketch.** Make `ProductFilters` (and `ListProductsQuery.filters`) a
union instead of one object with independently optional fields: an
unpriced variant with neither bound, and a priced variant where a bound and
its `currency` are both required together. That makes the illegal state,
a bound with no currency, fail to compile rather than fail at runtime, and
`toMinorUnits` no longer needs a fallback because there is no longer a case
where `currency` could be missing while a bound is present.

## Entry 2: SKU length duplicated three times, not two

**Problem.** The maximum SKU length, 50, is written as a literal in three
separate places rather than two:

1. `Sku.MAX_LENGTH = 50`
   ([`sku.vo.ts:5`](../src/product/domain/value-objects/sku.vo.ts#L5)), the
   domain rule.
2. `varchar('sku', { length: 50 })`
   ([`products.schema.ts:21`](../src/shared/infrastructure/database/postgres/schema/products.schema.ts#L21)),
   the column definition.
3. A hardcoded `50` inside the integration test itself
   ([`schema.integration-spec.ts:48`](../test/setup/schema.integration-spec.ts#L48)),
   in a test named `'bounds sku to the length the domain enforces'`
   ([`schema.integration-spec.ts:39`](../test/setup/schema.integration-spec.ts#L39)).

The test's name claims it couples the schema to the domain, but it asserts
`character_maximum_length` against a bare `50`, not against `Sku.MAX_LENGTH`.
It is a third independent copy of the number, not a check that the other two
agree. All three can drift together: raise the domain's limit, forget the
column, and this test still passes, because it never read the domain's
constant in the first place.

**Why deferred.** All three currently agree, so there is no active bug to
fix, only a test that cannot do the one job its name promises. Changing it
requires deciding where `Sku.MAX_LENGTH` should be visible from, which the
fix sketch below flags as a boundary question, not a one-line edit.

**Fix sketch.** Import `Sku.MAX_LENGTH` into
`test/setup/schema.integration-spec.ts` and assert
`character_maximum_length` against it instead of a literal `50`. That alone
makes the test genuinely couple the schema to the domain: a future change to
`Sku.MAX_LENGTH` with no matching schema change now fails this test instead
of passing silently. Importing `Sku.MAX_LENGTH` into `products.schema.ts`
itself, so the column definition and the domain rule share one constant
directly, is the stronger fix, since it removes the second copy rather than
only detecting drift in it. Check that import against the layer rules in
[the layer table](./architecture.md#layers-and-enforcement) first:
`infrastructure` may import `domain`, so the import itself is allowed, but
confirm a plain numeric constant is the kind of thing worth crossing that
boundary for before making the change.
