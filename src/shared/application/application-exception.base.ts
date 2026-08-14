export type ApplicationErrorKind = 'conflict' | 'not-found';

export abstract class ApplicationException extends Error {
  abstract readonly code: string;
  abstract readonly kind: ApplicationErrorKind;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}
