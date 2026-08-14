import fc from 'fast-check';
import { catchError } from '@test/support/catch-error';
import { InvalidMoneyException } from '../exceptions/invalid-money.exception';
import { Money } from './money.vo';

describe('Money', () => {
  describe('fromMinorUnits', () => {
    it('keeps the exact count it was given', () => {
      expect(Money.fromMinorUnits(1999, 'EUR').minorUnits).toBe(1999);
    });

    it('derives the decimal amount', () => {
      expect(Money.fromMinorUnits(1999, 'EUR').amount).toBe(19.99);
    });

    it('accepts zero', () => {
      expect(Money.fromMinorUnits(0, 'EUR').minorUnits).toBe(0);
    });

    it('rejects a negative count', () => {
      expect(
        catchError(() => Money.fromMinorUnits(-1, 'EUR'), InvalidMoneyException)
          .code,
      ).toBe('MONEY_INVALID');
    });

    it('rejects a fractional count', () => {
      expect(
        catchError(
          () => Money.fromMinorUnits(1.5, 'EUR'),
          InvalidMoneyException,
        ).message,
      ).toMatch(/whole number/);
    });
  });

  describe('fromDecimal', () => {
    it('converts two decimal places exactly', () => {
      expect(Money.fromDecimal(19.99, 'EUR').minorUnits).toBe(1999);
    });

    it('converts one decimal place', () => {
      expect(Money.fromDecimal(19.9, 'EUR').minorUnits).toBe(1990);
    });

    it('converts a whole number', () => {
      expect(Money.fromDecimal(20, 'EUR').minorUnits).toBe(2000);
    });

    it('rejects three decimal places rather than rounding them away', () => {
      expect(
        catchError(
          () => Money.fromDecimal(19.999, 'EUR'),
          InvalidMoneyException,
        ).message,
      ).toMatch(/decimal places/);
    });

    it('rejects a half-cent', () => {
      expect(() => Money.fromDecimal(1.005, 'EUR')).toThrow();
    });

    it('rejects a negative amount', () => {
      expect(() => Money.fromDecimal(-0.01, 'EUR')).toThrow();
    });

    it('rejects values that are not finite', () => {
      expect(() => Money.fromDecimal(Number.NaN, 'EUR')).toThrow();
      expect(() =>
        Money.fromDecimal(Number.POSITIVE_INFINITY, 'EUR'),
      ).toThrow();
    });
  });

  describe('currency', () => {
    it('normalises to uppercase', () => {
      expect(Money.fromDecimal(1, 'eur').currency).toBe('EUR');
    });

    it('rejects a currency that is not exactly three letters', () => {
      for (const currency of ['EURO', 'EU', '', '12 ', 'E1R']) {
        expect(() => Money.fromDecimal(1, currency)).toThrow(
          InvalidMoneyException.invalidCurrency(currency).message,
        );
      }
    });
  });

  describe('equals', () => {
    it('is true for the same amount and currency', () => {
      expect(
        Money.fromMinorUnits(100, 'EUR').equals(
          Money.fromMinorUnits(100, 'EUR'),
        ),
      ).toBe(true);
    });

    it('is false across currencies', () => {
      expect(
        Money.fromMinorUnits(100, 'EUR').equals(
          Money.fromMinorUnits(100, 'USD'),
        ),
      ).toBe(false);
    });

    it('is false for values that are not Money', () => {
      const money = Money.fromMinorUnits(100, 'EUR');

      expect(money.equals('100 EUR')).toBe(false);
      expect(money.equals(null)).toBe(false);
      expect(money.equals({ minorUnits: 100, currency: 'EUR' })).toBe(false);
    });
  });

  describe('properties', () => {
    const anyStorableAmount = fc.integer({ min: 0, max: 2_147_483_647 });

    it('round-trips any count of minor units the integer column can hold', () => {
      fc.assert(
        fc.property(anyStorableAmount, (minorUnits) => {
          expect(Money.fromMinorUnits(minorUnits, 'EUR').minorUnits).toBe(
            minorUnits,
          );
        }),
      );
    });

    it('round-trips any amount expressible in two decimal places', () => {
      fc.assert(
        fc.property(anyStorableAmount, (minorUnits) => {
          const decimal = minorUnits / 100;
          const money = Money.fromDecimal(decimal, 'EUR');

          expect(money.minorUnits).toBe(minorUnits);
          expect(money.amount).toBe(decimal);
        }),
      );
    });
  });
});
