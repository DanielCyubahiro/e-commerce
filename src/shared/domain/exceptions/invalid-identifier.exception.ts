import {
  type DomainErrorKind,
  DomainException,
} from '../domain-exception.base';

/**
 * `kind: 'malformed-identifier'` surfaces as 400 Bad Request, per
 * `STATUS_BY_KIND` in `domain-exception.filter.ts`.
 */
export class InvalidIdentifierException extends DomainException {
  readonly code = 'IDENTIFIER_INVALID';
  readonly kind: DomainErrorKind = 'malformed-identifier';

  constructor(readonly value: string) {
    super(`"${value}" is not a valid identifier.`);
  }
}
