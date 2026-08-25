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

    it('rejects an amount written in exponential notation', () => {
      // 1e-7 stringifies as "1e-7", so counting decimal places by string would
      // read zero. Such magnitudes are unrepresentable, not precise.
      expect(
        catchError(() => Money.fromDecimal(1e-7, 'EUR'), InvalidMoneyException)
          .message,
      ).toMatch(/decimal places/);
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

  describe('arithmetic', () => {
    it('zero carries the normalised currency and no amount', () => {
      const zero = Money.zero(' eur ');

      expect(zero.minorUnits).toBe(0);
      expect(zero.currency).toBe('EUR');
    });

    it('adds two amounts of one currency exactly', () => {
      const sum = Money.fromMinorUnits(1999, 'EUR').add(
        Money.fromMinorUnits(1, 'EUR'),
      );

      expect(sum.minorUnits).toBe(2000);
      expect(sum.currency).toBe('EUR');
    });

    it('rejects adding across currencies', () => {
      const error = catchError(
        () =>
          Money.fromMinorUnits(1, 'EUR').add(Money.fromMinorUnits(1, 'USD')),
        InvalidMoneyException,
      );

      expect(error.code).toBe('MONEY_INVALID');
      expect(error.message).toMatch(/EUR.*USD/);
    });

    it('multiplies by an integer factor exactly', () => {
      expect(Money.fromMinorUnits(1999, 'EUR').multiply(3).minorUnits).toBe(
        5997,
      );
    });

    it('multiplying by zero yields zero in the same currency', () => {
      const product = Money.fromMinorUnits(1999, 'EUR').multiply(0);

      expect(product.minorUnits).toBe(0);
      expect(product.currency).toBe('EUR');
    });

    it('rejects a fractional factor', () => {
      expect(
        catchError(
          () => Money.fromMinorUnits(100, 'EUR').multiply(1.5),
          InvalidMoneyException,
        ).message,
      ).toMatch(/whole number/);
    });

    it('rejects a negative factor', () => {
      expect(
        catchError(
          () => Money.fromMinorUnits(100, 'EUR').multiply(-1),
          InvalidMoneyException,
        ).message,
      ).toMatch(/negative/);
    });

    it('is closed under addition for any two valid amounts', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1_000_000 }),
          fc.integer({ min: 0, max: 1_000_000 }),
          (left, right) => {
            const sum = Money.fromMinorUnits(left, 'EUR').add(
              Money.fromMinorUnits(right, 'EUR'),
            );
            expect(sum.minorUnits).toBe(left + right);
          },
        ),
      );
    });
  });
});
