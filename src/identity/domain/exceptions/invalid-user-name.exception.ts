import { type DomainErrorKind, DomainException } from '@/shared/domain';

export type NamePart = 'first' | 'last';

/**
 * One exception for both names, because they share one rule; the factories name
 * which part failed. `kind: 'invariant'` surfaces as 422.
 */
export class InvalidUserNameException extends DomainException {
  readonly code = 'USER_NAME_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static empty(part: NamePart): InvalidUserNameException {
    return new InvalidUserNameException(`User ${part} name must not be empty.`);
  }

  static tooLong(part: NamePart, maxLength: number): InvalidUserNameException {
    return new InvalidUserNameException(
      `User ${part} name must be at most ${maxLength} characters long.`,
    );
  }
}
