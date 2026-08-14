import { Entity } from './entity.base';
import type { UniqueId } from './value-objects/unique-id.vo';

/**
 * Deliberately carries no domain event machinery, and deliberately does not
 * extend Nest's `AggregateRoot`. That base class inherits ten members this
 * codebase never calls, so a domain method named `publish`, `commit`, or `apply`
 * would silently override framework behaviour instead of declaring a rule. Its
 * `publish` and `commit` are also inert until the instance has passed through
 * `EventPublisher.mergeObjectContext`, and forgetting that call discards events
 * with no error and no log.
 *
 * When events are needed: add a private array with `protected raise(event)` and
 * a `pullDomainEvents()` that returns and clears, then publish from the command
 * handler where a framework dependency belongs.
 */
export abstract class AggregateRoot<
  TId extends UniqueId = UniqueId,
> extends Entity<TId> {}
