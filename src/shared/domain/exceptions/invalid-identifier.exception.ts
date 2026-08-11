import { DomainException } from '../base.domain-exception';

export class InvalidIdentifierException extends DomainException {
  readonly code = 'IDENTIFIER_INVALID';

  constructor(readonly value: string) {
    super(`"${value}" is not a valid identifier.`);
  }
}
