import { InvalidMoneyException } from '../exceptions/invalid-money.exception';

/**
 * Amounts are held as whole minor units, never as decimals, because binary
 * floating point cannot represent most decimal fractions exactly: 19.99 is
 * stored as 19.989999999999998, so decimal amounts drift under arithmetic and a
 * value read back is not guaranteed to equal the value written.
 *
 * The minor-unit exponent is fixed at 2, which is right for EUR and USD and
 * wrong for JPY (0) and KWD (3).
 */
export class Money {
  private static readonly CURRENCY_PATTERN = /^[A-Z]{3}$/;
  private static readonly MINOR_UNITS_PER_MAJOR = 100;
  private static readonly DECIMAL_PLACES = 2;

  private constructor(
    private readonly _minorUnits: number,
    private readonly _currency: string,
  ) {}

  static fromMinorUnits(minorUnits: number, currency: string): Money {
    if (!Number.isInteger(minorUnits)) {
      throw InvalidMoneyException.notAnInteger(minorUnits);
    }
    if (minorUnits < 0) {
      throw InvalidMoneyException.negativeAmount(minorUnits);
    }

    return new Money(minorUnits, Money.normaliseCurrency(currency));
  }

  static fromDecimal(amount: number, currency: string): Money {
    if (!Number.isFinite(amount)) {
      throw InvalidMoneyException.notFinite(amount);
    }
    if (amount < 0) {
      throw InvalidMoneyException.negativeAmount(amount);
    }
    if (Money.decimalPlaces(amount) > Money.DECIMAL_PLACES) {
      throw InvalidMoneyException.tooManyDecimalPlaces(
        amount,
        Money.DECIMAL_PLACES,
      );
    }

    return new Money(
      Math.round(amount * Money.MINOR_UNITS_PER_MAJOR),
      Money.normaliseCurrency(currency),
    );
  }

  static zero(currency: string): Money {
    return new Money(0, Money.normaliseCurrency(currency));
  }

  /** @throws InvalidMoneyException when the currencies differ */
  add(other: Money): Money {
    if (this._currency !== other._currency) {
      throw InvalidMoneyException.currencyMismatch(
        this._currency,
        other._currency,
      );
    }

    return new Money(this._minorUnits + other._minorUnits, this._currency);
  }

  /**
   * Integer factors only: a quantity, never a rate. Rates would reopen the
   * rounding question this class exists to close.
   *
   * @throws InvalidMoneyException for a fractional or negative factor
   */
  multiply(factor: number): Money {
    if (!Number.isInteger(factor)) {
      throw InvalidMoneyException.notAnIntegerFactor(factor);
    }
    if (factor < 0) {
      throw InvalidMoneyException.negativeFactor(factor);
    }

    return new Money(this._minorUnits * factor, this._currency);
  }

  get minorUnits(): number {
    return this._minorUnits;
  }

  get amount(): number {
    return this._minorUnits / Money.MINOR_UNITS_PER_MAJOR;
  }

  get currency(): string {
    return this._currency;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof Money &&
      this._minorUnits === other._minorUnits &&
      this._currency === other._currency
    );
  }

  private static normaliseCurrency(currency: string): string {
    const normalised = currency.trim().toUpperCase();
    if (!Money.CURRENCY_PATTERN.test(normalised)) {
      throw InvalidMoneyException.invalidCurrency(currency);
    }

    return normalised;
  }

  /**
   * Counting places before multiplying is what makes the later `Math.round`
   * safe: rounding is only reliable once the input is known to fit the
   * currency's precision. `Math.round(4.475 * 100)` is 447, not 448.
   *
   * Exponential notation is treated as unrepresentable rather than parsed, since
   * it only appears at magnitudes no 2-decimal currency amount reaches.
   */
  private static decimalPlaces(value: number): number {
    const text = value.toString();
    if (text.includes('e') || text.includes('E')) {
      return Number.MAX_SAFE_INTEGER;
    }

    return text.split('.')[1]?.length ?? 0;
  }
}
