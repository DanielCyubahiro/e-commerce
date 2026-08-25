import { catchError } from '@test/support/catch-error';
import { InvalidShippingAddressException } from '../exceptions/invalid-shipping-address.exception';
import {
  ShippingAddress,
  type ShippingAddressInput,
} from './shipping-address.vo';

const input = (
  overrides: Partial<ShippingAddressInput> = {},
): ShippingAddressInput => ({
  recipientName: 'Ada Lovelace',
  line1: '1 Analytical Way',
  city: 'London',
  postalCode: 'N1 1AA',
  country: 'gb',
  ...overrides,
});

describe('ShippingAddress', () => {
  it('trims every field and uppercases the country', () => {
    const address = ShippingAddress.create(
      input({
        recipientName: '  Ada Lovelace ',
        line1: ' 1 Analytical Way ',
        line2: ' Flat 2 ',
        city: ' London ',
        region: ' Greater London ',
        postalCode: ' N1 1AA ',
        country: ' gb ',
      }),
    );

    expect(address.recipientName).toBe('Ada Lovelace');
    expect(address.line1).toBe('1 Analytical Way');
    expect(address.line2).toBe('Flat 2');
    expect(address.city).toBe('London');
    expect(address.region).toBe('Greater London');
    expect(address.postalCode).toBe('N1 1AA');
    expect(address.country).toBe('GB');
  });

  it.each<[string, ShippingAddressInput]>([
    ['an absent key', input()],
    ['undefined', input({ line2: undefined, region: undefined })],
    ['null', input({ line2: null, region: null })],
    ['blank', input({ line2: '   ', region: '' })],
  ])('collapses %s optional fields to null', (_case, given) => {
    const address = ShippingAddress.create(given);

    expect(address.line2).toBeNull();
    expect(address.region).toBeNull();
  });

  it.each<[keyof ShippingAddressInput]>([
    ['recipientName'],
    ['line1'],
    ['city'],
    ['postalCode'],
  ])('rejects an empty %s', (field) => {
    const error = catchError(
      () => ShippingAddress.create(input({ [field]: '   ' })),
      InvalidShippingAddressException,
    );

    expect(error.code).toBe('ORDER_SHIPPING_ADDRESS_INVALID');
    expect(error.message).toMatch(field);
  });

  it.each<[keyof ShippingAddressInput, number]>([
    ['recipientName', 200],
    ['line1', 200],
    ['line2', 200],
    ['city', 100],
    ['region', 100],
    ['postalCode', 20],
  ])('rejects a %s longer than %i characters', (field, max) => {
    expect(
      ShippingAddress.create(input({ [field]: 'x'.repeat(max) })),
    ).toBeInstanceOf(ShippingAddress);

    const error = catchError(
      () => ShippingAddress.create(input({ [field]: 'x'.repeat(max + 1) })),
      InvalidShippingAddressException,
    );

    expect(error.message).toMatch(String(max));
  });

  it.each(['G', 'GBR', 'G1', 'Great Britain', ''])(
    'rejects %p as a country',
    (country) => {
      const error = catchError(
        () => ShippingAddress.create(input({ country })),
        InvalidShippingAddressException,
      );

      expect(error.message).toMatch(/two letters/);
    },
  );

  it('compares by value across every field', () => {
    const base = ShippingAddress.create(input({ line2: 'Flat 2' }));

    expect(
      base.equals(ShippingAddress.create(input({ line2: 'Flat 2' }))),
    ).toBe(true);
    expect(base.equals(ShippingAddress.create(input()))).toBe(false);
    expect(
      base.equals(
        ShippingAddress.create(input({ line2: 'Flat 2', city: 'Leeds' })),
      ),
    ).toBe(false);
    expect(base.equals({ city: 'London' })).toBe(false);
  });
});
