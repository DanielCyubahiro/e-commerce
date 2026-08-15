# 0005. One contract suite runs against every implementation

## Status

Accepted.

## Context

[`ProductWriteRepository`](../../src/product/application/ports/product.write-repository.ts)
and
[`ProductReadRepository`](../../src/product/application/ports/product.read-repository.ts)
each have two implementations: an in-memory fake used by fast application
handler tests, and a Drizzle adapter used against real Postgres. See
[Fake versus mock](../concepts.md#fake-versus-mock) for what makes the fake a
fake rather than a mock. Handler tests only ever exercise the fake, so nothing
stops the fake's behaviour drifting away from what the Drizzle adapter
actually does, and if that happens every handler test built on the fake ends
up proving correctness against a specification that no longer matches
production.

## Decision

Each port gets exactly one exported contract function, taking a name and a
harness factory, that declares the full suite of behaviour every
implementation must satisfy. The write side's is
[`productWriteRepositoryContract`](../../test/contracts/product-write-repository.contract.ts#L14-L18),
and its own doc comment states the rationale directly: divergence has to be a
test failure rather than a surprise. Two binding files invoke each contract,
one constructing the in-memory fake and one constructing the Drizzle adapter
against a real connection; see
[the contract mechanism](../testing.md#the-contract-mechanism) for the two
harness shapes and how the bindings differ. `jest/no-export` is disabled for
`test/contracts/*.contract.ts` in
[`eslint.config.mjs`](../../eslint.config.mjs), since these files are modules
imported by two runners rather than files Jest executes directly, and
exporting from them is the point rather than an oversight the rule should
catch.

## Alternatives considered

- **Test the Drizzle adapter only, with no shared suite.** Rejected: the
  in-memory fake used by every handler test would have nothing holding it to
  the same behaviour, so it could drift silently, and every handler test built
  on top of it would become a liability rather than evidence.
- **Test the in-memory fake only.** Rejected: passing tests against the fake
  prove nothing about the Drizzle adapter or the real database, which is what
  actually runs in production.

## Consequences

- Divergence between the fake and the real adapter becomes a test failure at
  the contract level, rather than a surprise discovered later in a handler
  test or in production.
- This is the mechanism that makes forking the infrastructure layer onto a
  different database or ORM safe: an adapter that passes the same contract is
  substitutable by construction. The full procedure lives in
  [the fork seam](../architecture.md#fork-seam); this decision records why the
  mechanism exists, not how to run it.
- Adding a method to a port, or a case to a contract, breaks both
  implementations' bindings at once until each is updated to satisfy it. That
  is the intended failure mode, not a cost to avoid.
