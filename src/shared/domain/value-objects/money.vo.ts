import { InvalidMoneyException } from '../exceptions/invalid-money.exception';

export class Money {
  private readonly _amount: number;
  private readonly _currency: string;

  private constructor(amount: number, currency: string) {
    this._amount = amount;
    this._currency = currency;
  }

  static create(amount: number, currency: string = 'EUR'): Money {
    if (amount < 0) {
      throw InvalidMoneyException.negativeAmount(amount);
    }

    if (!currency || currency.trim() === '') {
      throw InvalidMoneyException.emptyCurrency();
    }

    return new Money(amount, currency);
  }

  get amount(): number {
    return this._amount;
  }

  get currency(): string {
    return this._currency;
  }

  toCents(): number {
    return Math.round(this._amount * 100);
  }
}
