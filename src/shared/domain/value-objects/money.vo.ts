export class Money {
  private readonly amount: number;
  private readonly currency: string;

  private constructor(amount: number, currency: string) {
    this.amount = amount;
    this.currency = currency;
  }

  static create(amount: number, currency: string = 'EUR'): Money {
    if (amount < 0) {
      throw new Error('Amount cannot be negative');
    }

    if (!currency || currency.trim() === '') {
      throw new Error('Currency cannot be empty');
    }

    return new Money(amount, currency);
  }

  getAmount(): number {
    return this.amount;
  }

  getCurrency(): string {
    return this.currency;
  }

  toCent(): number {
    return Math.round(this.amount * 100);
  }
}
