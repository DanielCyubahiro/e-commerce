# 0012. Contexts are named for capabilities

## Status

Accepted.

## Context

`src/user/` and `src/product/` were named after the one aggregate each context
happened to own at the time it was created. That naming works only as long as
a context owns exactly one aggregate; the moment a context takes on a second
one, the directory name stops describing what the context is for and instead
just points at whichever aggregate got there first, drifting toward reading
as a CRUD wrapper around one table rather than a capability.

## Decision

`src/user/` is renamed to `src/identity/`, and `src/product/` to
`src/catalogue/`. A context is named for the business capability it provides,
never for an entity it owns. Only the context renames: the `User` and
`Product` aggregates, their value objects, the `users` and `products` tables,
the `/users` and `/products` endpoints, and every error code are unchanged.
Error codes keep their `USER_` and `PRODUCT_` prefixes deliberately, since
they are a client-facing contract and this rename is internal to the codebase.
The two Nest module files and classes move and rename with their context:
`user.module.ts`/`UserModule` becomes `identity.module.ts`/`IdentityModule`,
and `product.module.ts`/`ProductModule` becomes
`catalogue.module.ts`/`CatalogueModule`.

The rule itself is recorded in `docs/concepts.md`'s "Bounded context" entry
and enforced by
[`context-naming.docs-spec.ts`](../../test/docs/context-naming.docs-spec.ts),
which fails whenever a context directory shares a (case-insensitive) name
with an entity declared under its own `domain/entities/`. Leaving the rule to
discipline alone would let the next context regress the same way `user` and
`product` did, silently, since nothing else would notice.

## Alternatives considered

- **Keep the entity names.** Rejected: it is the status quo this record
  changes, and the problem it causes, a context name that stops describing
  the context the moment it owns a second aggregate or a capability with no
  single owning entity, is exactly what motivates the rename.
- **Rename only `user` to `identity`, and grandfather `product` behind an
  allowlist in the test.** Rejected: an allowlist is a second, competing
  source of truth for the rule the test exists to enforce, and it leaves the
  same entity-named-context smell sitting in the codebase the test was
  written to catch. Renaming both once is cheaper than carrying an exception
  forward indefinitely.

## Consequences

- Every source and test import moves from `@/user/`/`@/product/` to
  `@/identity/`/`@/catalogue/`; the aggregates, tables, endpoints, and error
  codes it imports are untouched.
- A later context that spans multiple aggregates, or owns none directly, has a
  naming convention to follow rather than inventing one under time pressure.
- `context-naming.docs-spec.ts` runs against every context `readDocsModel`
  discovers, so the check applies to any future context automatically,
  without needing its name added anywhere.
