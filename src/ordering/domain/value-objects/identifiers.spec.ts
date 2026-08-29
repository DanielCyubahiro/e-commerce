import { InvalidIdentifierException } from '@/shared/domain';
import { catchError } from '@test/support/catch-error';
import { CustomerId } from './customer-id.vo';
import { OrderId } from './order-id.vo';
import { ProductRef } from './product-ref.vo';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe.each([
  ['OrderId', OrderId],
  ['CustomerId', CustomerId],
  ['ProductRef', ProductRef],
])('%s', (_name, Identifier) => {
  it('mints a fresh UUID with no argument', () => {
    expect(Identifier.create().value).toMatch(UUID);
    expect(Identifier.create().value).not.toBe(Identifier.create().value);
  });

  it('parses and lowercases a given value', () => {
    expect(
      Identifier.create(' 3F2504E0-4F89-41D3-9A0C-0305E82C3301 ').value,
    ).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301');
  });

  it('rejects a malformed value', () => {
    expect(
      catchError(() => Identifier.create('nope'), InvalidIdentifierException)
        .code,
    ).toBe('IDENTIFIER_INVALID');
  });
});

it('a ProductRef and a CustomerId sharing a value are still not equal', () => {
  const value = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';

  expect(ProductRef.create(value).equals(CustomerId.create(value))).toBe(false);
});
