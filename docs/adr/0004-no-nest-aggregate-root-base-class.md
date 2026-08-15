# 0004. `AggregateRoot` is empty, not Nest's

## Status

Accepted.

## Context

Nest CQRS ships its own `AggregateRoot` base class. `Product` needs some
shared identity and equality behaviour regardless of which base it extends
(see [Entity](../concepts.md#entity)). Separately, the domain layer is
ESLint-enforced to import no framework at all: the `src/*/domain/**/*.ts`
block in [`eslint.config.mjs`](../../eslint.config.mjs) forbids `@nestjs/*`
(see [the layer table](../architecture.md#layers-and-enforcement)). Reaching
for Nest's `AggregateRoot` would cross that boundary directly, but the
boundary rule is not the only reason to avoid it.

## Decision

[`AggregateRoot`](../../src/shared/domain/aggregate-root.base.ts) is this
codebase's own class, and it is deliberately empty: it extends
[`Entity`](../../src/shared/domain/entity.base.ts) and adds nothing (see
[`aggregate-root.base.ts:4-16`](../../src/shared/domain/aggregate-root.base.ts#L4-L16)
for the class's own reasoning). It carries no domain event machinery today.

## Alternatives considered

- **Extend Nest CQRS's `AggregateRoot`.** Rejected for two reasons, both
  recorded in the base class's own comment. First, that class brings ten
  members this codebase never calls, so a domain method that happened to be
  named `publish`, `commit`, or `apply` would silently override framework
  behaviour instead of declaring a domain rule, an easy and quiet collision
  since none of those are unreasonable names for a domain method to want.
  Second, Nest's `publish` and `commit` are inert until the instance has
  passed through `EventPublisher.mergeObjectContext`; forgetting that call
  discards events with no error and no log, a failure with no signal at the
  point it happens.
- **No base class at all**, `Product` extending nothing shared. Rejected: it
  would lose the identity and equality behaviour `Entity` already provides
  (`Entity.equals` compares by id and by constructor together), which every
  future aggregate would otherwise have to reimplement, or get subtly wrong,
  on its own.

## Consequences

- The domain stays framework-free, which
  [the linter enforces](../architecture.md#layers-and-enforcement)
  independently of this decision, so the two reasons reinforce each other
  rather than duplicating one another.
- Domain events are not available yet. When they are needed, the documented
  path is a private array on `AggregateRoot`, a `protected raise(event)`
  method to append to it, and a `pullDomainEvents()` that returns the array
  and clears it. Publishing happens from the command handler, which is where
  a framework dependency belongs, not on the aggregate itself.
