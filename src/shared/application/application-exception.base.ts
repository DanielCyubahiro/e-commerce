// New members here are a compile error in `application-exception.filter.ts`'s
// `STATUS_BY_KIND` until a status is assigned, never a silent runtime
// fallthrough.
export type ApplicationErrorKind =
  'conflict' | 'not-found' | 'unauthorized' | 'forbidden';

/**
 * Base for every application-layer error. `code` is a stable, machine-readable
 * identifier surfaced to API clients. `kind` decides the HTTP status a caller
 * sees; see `STATUS_BY_KIND` in `application-exception.filter.ts`.
 */
export abstract class ApplicationException extends Error {
  abstract readonly code: string;
  abstract readonly kind: ApplicationErrorKind;

  /**
   * Structured data a client can act on, for example which products fell
   * short. Emitted by the filter as `details` only when defined, so the body
   * shape stays `{ statusCode, code, message }` for every other exception.
   */
  readonly details?: unknown;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
