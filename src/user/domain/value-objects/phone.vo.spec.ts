import { catchError } from '@test/support/catch-error';
import { InvalidPhoneException } from '../exceptions/invalid-phone.exception';
import { Phone } from './phone.vo';

describe('Phone', () => {
  it('strips separators and stores the E.164 form', () => {
    expect(Phone.create(' +32 (0)489-12.34.56 ').value).toBe('+320489123456');
  });

  it('compares by value', () => {
    expect(
      Phone.create('+32489123456').equals(Phone.create('+32 489 123 456')),
    ).toBe(true);
    expect(Phone.create('+32489123456').equals('+32489123456')).toBe(false);
  });

  it.each([
    ['no leading plus', '32489123456'],
    ['a letter in the number', '+3248912345a'],
    ['a plus only', '+'],
  ])('rejects %s', (_case, value) => {
    const error = catchError(() => Phone.create(value), InvalidPhoneException);

    expect(error).toBeInstanceOf(InvalidPhoneException);
    expect(error.code).toBe('USER_PHONE_INVALID');
  });

  it.each([
    ['fewer than 8 digits', '+1234567'],
    ['more than 15 digits', '+1234567890123456'],
  ])('rejects %s', (_case, value) => {
    expect(
      catchError(() => Phone.create(value), InvalidPhoneException),
    ).toBeInstanceOf(InvalidPhoneException);
  });

  it('accepts the boundary lengths', () => {
    expect(Phone.create('+12345678').value).toBe('+12345678');
    expect(Phone.create('+123456789012345').value).toBe('+123456789012345');
  });
});
