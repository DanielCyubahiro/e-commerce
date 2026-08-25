import { type DomainErrorKind, DomainException } from '@/shared/domain';

/**
 * `kind: 'illegal-transition'` surfaces as 409: the request was well formed,
 * the order is simply not in a state that allows the move.
 */
export class IllegalOrderTransitionException extends DomainException {
  readonly code = 'ORDER_TRANSITION_ILLEGAL';
  readonly kind: DomainErrorKind = 'illegal-transition';

  private constructor(message: string) {
    super(message);
  }

  static notAllowed(from: string, to: string): IllegalOrderTransitionException {
    return new IllegalOrderTransitionException(
      `An order that is ${from} cannot become ${to}.`,
    );
  }
}
