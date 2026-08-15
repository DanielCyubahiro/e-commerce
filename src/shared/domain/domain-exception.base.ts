// New members here are a compile error in `domain-exception.filter.ts`'s
// `STATUS_BY_KIND` until a status is assigned, never a silent runtime
// fallthrough.
export type DomainErrorKind = 'invariant' | 'malformed-identifier';

/**
 * Base for every domain-layer error. `code` is a stable, machine-readable
 * identifier surfaced to API clients. `kind` decides the HTTP status a caller
 * sees; see `STATUS_BY_KIND` in `domain-exception.filter.ts`.
 */
export abstract class DomainException extends Error {
  abstract readonly code: string;
  abstract readonly kind: DomainErrorKind;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
