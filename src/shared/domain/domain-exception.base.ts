export type DomainErrorKind = 'invariant' | 'malformed-identifier';

export abstract class DomainException extends Error {
  abstract readonly code: string;
  abstract readonly kind: DomainErrorKind;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
