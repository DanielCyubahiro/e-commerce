import {
  InvalidShippingAddressException,
  type ShippingAddressField,
} from '../exceptions/invalid-shipping-address.exception';

/**
 * `line2` and `region` accept three spellings of absence because the edge
 * produces all three; a value that is blank after trimming counts as absent
 * too. The tolerance ends in `create`, which stores `null`. See ADR 0011.
 */
export interface ShippingAddressInput {
  recipientName: string;
  line1: string;
  line2?: string | null | undefined;
  city: string;
  region?: string | null | undefined;
  postalCode: string;
  country: string;
}

type BoundedField = Exclude<ShippingAddressField, 'country'>;

// Must stay equal to the ship_* varchar lengths in orders.schema.ts.
const MAX_LENGTH: Record<BoundedField, number> = {
  recipientName: 200,
  line1: 200,
  line2: 200,
  city: 100,
  region: 100,
  postalCode: 20,
};

const COUNTRY_PATTERN = /^[A-Z]{2}$/;

/**
 * Where the order ships, copied onto the order at placement. Deliberately
 * shallow: presence, length, and a two-letter country. No per-country postal
 * code formats; that is a rabbit hole with a poor payoff.
 */
export class ShippingAddress {
  private constructor(
    private readonly _recipientName: string,
    private readonly _line1: string,
    private readonly _line2: string | null,
    private readonly _city: string,
    private readonly _region: string | null,
    private readonly _postalCode: string,
    private readonly _country: string,
  ) {}

  /**
   * @throws InvalidShippingAddressException for an empty required field, a
   * field over its ceiling, or a country that is not two letters
   */
  static create(input: ShippingAddressInput): ShippingAddress {
    return new ShippingAddress(
      ShippingAddress.required('recipientName', input.recipientName),
      ShippingAddress.required('line1', input.line1),
      ShippingAddress.optional('line2', input.line2),
      ShippingAddress.required('city', input.city),
      ShippingAddress.optional('region', input.region),
      ShippingAddress.required('postalCode', input.postalCode),
      ShippingAddress.country(input.country),
    );
  }

  private static required(field: BoundedField, value: string): string {
    const trimmed = value.trim();

    if (trimmed.length === 0) {
      throw InvalidShippingAddressException.empty(field);
    }

    return ShippingAddress.bounded(field, trimmed);
  }

  private static optional(
    field: BoundedField,
    value: string | null | undefined,
  ): string | null {
    // `?? ''` folds undefined and null into the blank case below, so all four
    // spellings of absence leave through one return.
    const trimmed = (value ?? '').trim();

    return trimmed.length === 0
      ? null
      : ShippingAddress.bounded(field, trimmed);
  }

  private static bounded(field: BoundedField, trimmed: string): string {
    if (trimmed.length > MAX_LENGTH[field]) {
      throw InvalidShippingAddressException.tooLong(field, MAX_LENGTH[field]);
    }

    return trimmed;
  }

  private static country(value: string): string {
    const normalised = value.trim().toUpperCase();

    if (!COUNTRY_PATTERN.test(normalised)) {
      throw InvalidShippingAddressException.invalidCountry(value);
    }

    return normalised;
  }

  get recipientName(): string {
    return this._recipientName;
  }

  get line1(): string {
    return this._line1;
  }

  /** `null`, never `undefined`, when absent. */
  get line2(): string | null {
    return this._line2;
  }

  get city(): string {
    return this._city;
  }

  /** `null`, never `undefined`, when absent. */
  get region(): string | null {
    return this._region;
  }

  get postalCode(): string {
    return this._postalCode;
  }

  /** ISO 3166-1 alpha-2, uppercase. */
  get country(): string {
    return this._country;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof ShippingAddress &&
      this._recipientName === other._recipientName &&
      this._line1 === other._line1 &&
      this._line2 === other._line2 &&
      this._city === other._city &&
      this._region === other._region &&
      this._postalCode === other._postalCode &&
      this._country === other._country
    );
  }
}
