import {
  type DomainErrorKind,
  DomainException,
} from '../domain-exception.base';

/**
 * `kind: 'invariant'` surfaces as 422 Unprocessable Entity, per
 * `STATUS_BY_KIND` in `domain-exception.filter.ts`.
 */
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

  static currencyMismatch(left: string, right: string): InvalidMoneyException {
    return new InvalidMoneyException(
      `Cannot combine amounts in ${left} and ${right}.`,
    );
  }

  static notAnIntegerFactor(factor: number): InvalidMoneyException {
    return new InvalidMoneyException(
      `A multiplier must be a whole number, received ${factor}.`,
    );
  }

  static negativeFactor(factor: number): InvalidMoneyException {
    return new InvalidMoneyException(
      `A multiplier cannot be negative, received ${factor}.`,
    );
  }
}
