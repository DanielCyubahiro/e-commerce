import { type DomainErrorKind, DomainException } from '@/shared/domain';

/** `kind: 'invariant'` surfaces as 422. */
export class InvalidOrderStatusException extends DomainException {
  readonly code = 'ORDER_STATUS_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static unknown(
    value: string,
    allowed: readonly string[],
  ): InvalidOrderStatusException {
    return new InvalidOrderStatusException(
      `Order status must be one of ${allowed.join(', ')}, got "${value}".`,
    );
  }
}
