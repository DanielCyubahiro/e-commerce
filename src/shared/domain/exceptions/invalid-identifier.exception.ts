import {
  type DomainErrorKind,
  DomainException,
} from '../domain-exception.base';

export class InvalidIdentifierException extends DomainException {
  readonly code = 'IDENTIFIER_INVALID';
  readonly kind: DomainErrorKind = 'malformed-identifier';

  constructor(readonly value: string) {
    super(`"${value}" is not a valid identifier.`);
  }
}
