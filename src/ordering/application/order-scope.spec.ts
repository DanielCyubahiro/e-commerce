import { customerFilterOf } from './order-scope';

describe('customerFilterOf', () => {
  it("returns the caller's own id under customer scope", () => {
    expect(
      customerFilterOf({ kind: 'customer', customerId: 'customer-1' }),
    ).toBe('customer-1');
  });

  it('returns undefined under staff scope, applying no filter', () => {
    expect(customerFilterOf({ kind: 'staff' })).toBeUndefined();
  });
});
