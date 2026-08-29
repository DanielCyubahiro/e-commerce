import { Money } from '@/shared/domain';
import { ProductRef } from './product-ref.vo';
import { Quantity } from './quantity.vo';

/** The allocator's snapshot of one product plus the quantity taken, as primitives. */
export interface OrderLineInput {
  productId: string;
  sku: string;
  name: string;
  unitPriceMinorUnits: number;
  currency: string;
  quantity: number;
}

/**
 * One product on an order, as it was sold: `sku` and `name` are copies taken
 * at allocation, not references, so a later catalogue edit or deletion cannot
 * change what this order says. A value object, not an entity: two lines with
 * the same product on one order are forbidden, so `(order, product)` is
 * identity enough.
 */
export class OrderLine {
  private constructor(
    private readonly _productRef: ProductRef,
    private readonly _sku: string,
    private readonly _name: string,
    private readonly _unitPrice: Money,
    private readonly _quantity: Quantity,
    private readonly _lineTotal: Money,
  ) {}

  /**
   * Also the reconstitution path: every field is stored as given, so the write
   * adapter rebuilds a line through this and gets an equal one.
   *
   * @throws InvalidMoneyException, InvalidQuantityException,
   * InvalidIdentifierException from the value objects it composes
   */
  static create(input: OrderLineInput): OrderLine {
    const unitPrice = Money.fromMinorUnits(
      input.unitPriceMinorUnits,
      input.currency,
    );
    const quantity = Quantity.create(input.quantity);

    return new OrderLine(
      ProductRef.create(input.productId),
      input.sku.trim(),
      input.name.trim(),
      unitPrice,
      quantity,
      unitPrice.multiply(quantity.value),
    );
  }

  get productRef(): ProductRef {
    return this._productRef;
  }

  get sku(): string {
    return this._sku;
  }

  get name(): string {
    return this._name;
  }

  get unitPrice(): Money {
    return this._unitPrice;
  }

  get quantity(): Quantity {
    return this._quantity;
  }

  get lineTotal(): Money {
    return this._lineTotal;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof OrderLine &&
      this._productRef.equals(other._productRef) &&
      this._sku === other._sku &&
      this._name === other._name &&
      this._unitPrice.equals(other._unitPrice) &&
      this._quantity.equals(other._quantity)
    );
  }
}
