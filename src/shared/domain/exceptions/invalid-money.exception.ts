import {
  type DomainErrorKind,
  DomainException,
} from '../base.domain-exception';

export class InvalidMoneyException extends DomainException {
  readonly code = 'MONEY_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static negativeAmount(amount: number): InvalidMoneyException {
    return new InvalidMoneyException(
      `Amount cannot be negative, received ${amount}.`,
    );
  }

  static emptyCurrency(): InvalidMoneyException {
    return new InvalidMoneyException('Currency cannot be empty.');
  }
}
