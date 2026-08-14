import {
  type DomainErrorKind,
  DomainException,
} from '../domain-exception.base';

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

  static notAnInteger(minorUnits: number): InvalidMoneyException {
    return new InvalidMoneyException(
      `Minor units must be a whole number, received ${minorUnits}.`,
    );
  }

  static notFinite(amount: number): InvalidMoneyException {
    return new InvalidMoneyException(
      `Amount must be a finite number, received ${amount}.`,
    );
  }

  static tooManyDecimalPlaces(
    amount: number,
    allowed: number,
  ): InvalidMoneyException {
    return new InvalidMoneyException(
      `Amount ${amount} has more than ${allowed} decimal places, which this currency cannot represent.`,
    );
  }

  static invalidCurrency(currency: string): InvalidMoneyException {
    return new InvalidMoneyException(
      `Currency must be three letters, received "${currency}".`,
    );
  }
}
