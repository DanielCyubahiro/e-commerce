export class Money {
  private constructor(
    private readonly amount: number,
    private readonly currency: string,
  ) {}

  static create(amount: number, currency: string): Money {
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
}
