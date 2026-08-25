# 0008. Updating a product replaces it, without rehydration

## Status

Accepted for aggregates without a lifecycle. [0024](0024-lifecycle-aggregates-are-reconstituted-under-optimistic-concurrency.md)
narrows it: an aggregate with behaviour after creation is reconstituted and
saved under a version guard instead.

## Context

The write side of the catalogue context exposes exactly two operations on
[`ProductWriteRepository`](../../src/catalogue/application/ports/product.write-repository.ts),
`add` and `delete`. `Product.create` is the aggregate's only constructor, and
[ADR 0002](0002-read-write-split-without-rehydration.md) leans on that fact
directly: because nothing needs to build a `Product` from stored data, the
aggregate never had to expose a way to do it, and its constructor could stay
private.

`PUT /products/:id` needs to change a stored product. The shape of "change"
decides the rest of the design. A partial update, one where the caller sends
only the fields it wants to change, only works if the handler knows the
fields it was not sent, which means loading the product first: a `findById`
added to the write port, returning a `Product`. Returning a `Product` from
storage needs a construction path that skips the checks `Product.create`
runs, since a row already in the table was already valid when it was
written, and once loaded, changing individual fields needs mutation methods
on the aggregate, one path per field that can change independently of the
others.

## Decision

`PUT /products/:id` replaces every field, name, description, price,
currency, SKU, and stock, in one request; there is no partial form. The
handler builds a complete, validated `Product` under the caller's own id,
via [`Product.replace`](../../src/catalogue/domain/entities/product.entity.ts),
and hands it to the write adapter, which issues a single `UPDATE` matched on
that id. Nothing is loaded first: the handler never calls `findById`, because
a full replacement needs nothing from the row it overwrites. Success returns
204 with no body; a `Product` built fresh from the request body carries
nothing the client does not already have, so there is nothing worth
returning.

`currency` is required on the update DTO, even though
[`CreateProductDto`](../../src/catalogue/presentation/dtos/create-product.dto.ts)
defaults it on create. Under create, an omitted `currency` fills a blank;
under replace, an omitted `currency` would overwrite a stored value with a
default the client never chose. A default that fills a blank and a default
that overwrites a value are not the same feature, so the same default cannot
serve both.

The SKU is replaceable too, as a consequence of that reasoning rather than a
choice of its own: a full replace only works without a load if the request
carries every field the row has, so carving out any one field, SKU included,
as unreplaceable would force a load to preserve it, and the design would
collapse back into load, modify, save.

Concurrency is last-write-wins. Two `PUT`s racing on the same id both
succeed, and the row ends up holding whichever payload's `UPDATE` committed
last.

## Alternatives considered

- **`PATCH` with rehydration and aggregate mutation methods.** Rejected: it
  needs `findById` returning a `Product`, a construction path that skips
  `Product`'s invariant checks, and a mutator per mutable field, each one a
  place validation could be skipped or drift from `create`'s, undoing the
  single-path guarantee this record and [ADR 0002](0002-read-write-split-without-rehydration.md)
  both rely on.
- **A partial `UPDATE` with per-field validation in the handler or the
  adapter.** Rejected: it would force `Product`'s private validators into a
  public API so something outside the aggregate could call them, splitting
  one invariant across two paths with no mechanism keeping them in agreement,
  the same failure mode [ADR 0006](0006-validation-at-the-edge-versus-the-domain.md)
  rejects for DTOs.
- **An upsert-shaped `save` on the port**, creating a row if the id does not
  exist and replacing it if it does. Rejected: it would let a client mint its
  own id for a new product and choose whether a `PUT` was a create or a
  replace, destroying the 404 a replace against a missing id should return.
- **Returning 200 with the replaced product.** Rejected: it would put a
  command and a query behind one endpoint, and could not hand the aggregate
  to the controller regardless, since presentation may not import a domain
  entity.
- **Optimistic locking**, a `version` column or an `If-Match` precondition,
  rejected for now because nothing in this catalogue depends on detecting a
  lost update; last-write-wins is the simpler default until a concrete
  caller needs the guarantee.

## Consequences

- The aggregate has two public factories, `create` and `replace`, over one
  shared validation path, and still no non-validating construction path
  exists. "An invalid `Product` is never representable" still holds.
- A lost update is possible under concurrent `PUT`s, but because every write
  is a full replace, the row always ends up equal to exactly one of the two
  payloads, never a field-level mix of both.
- A client that needs the row's new `updated_at` must re-read the product;
  the 204 response carries none of the state the trigger from
  [ADR 0009](0009-postgres-owns-updated-at.md) just set.
- [ADR 0002](0002-read-write-split-without-rehydration.md)'s claim that
  `Product.create` is the only way to construct a `Product` is narrowed by
  this record; its actual decision, that queries never rehydrate the
  aggregate, is untouched, since `replace` is a write-side factory, not a
  query-side one.
- A later context that reuses this replace-without-rehydration shape may have
  a field that must not participate in it, the way identity's email must not;
  see [ADR 0014](0014-email-is-immutable-after-registration.md). "Replace"
  therefore means every *mutable* field a context's write DTO carries, not
  literally every field the aggregate has.
