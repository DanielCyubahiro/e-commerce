import { type DomainErrorKind, DomainException } from '@/shared/domain';

export type ShippingAddressField =
  | 'recipientName'
  | 'line1'
  | 'line2'
  | 'city'
  | 'region'
  | 'postalCode'
  | 'country';

/** `kind: 'invariant'` surfaces as 422. */
export class InvalidShippingAddressException extends DomainException {
  readonly code = 'ORDER_SHIPPING_ADDRESS_INVALID';
  readonly kind: DomainErrorKind = 'invariant';

  private constructor(message: string) {
    super(message);
  }

  static empty(field: ShippingAddressField): InvalidShippingAddressException {
    return new InvalidShippingAddressException(
      `Shipping address ${field} cannot be empty.`,
    );
  }

  static tooLong(
    field: ShippingAddressField,
    max: number,
  ): InvalidShippingAddressException {
    return new InvalidShippingAddressException(
      `Shipping address ${field} can be at most ${max} characters.`,
    );
  }

  static invalidCountry(value: string): InvalidShippingAddressException {
    return new InvalidShippingAddressException(
      `Country must be two letters (ISO 3166-1 alpha-2), received "${value}".`,
    );
  }
}
