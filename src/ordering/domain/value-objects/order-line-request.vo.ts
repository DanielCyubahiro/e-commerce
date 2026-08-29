import { ProductRef } from './product-ref.vo';
import { Quantity } from './quantity.vo';

export interface OrderLineRequestInput {
  productId: string;
  quantity: number;
}

/**
 * What a customer asks for, before the catalogue has said anything about it.
 * Exists because `Quantity`'s rule has to run before the stock allocator is
 * called; everything else about a line is checked after allocation by
 * `Order.place`, and a failure there rolls the allocation back.
 */
export class OrderLineRequest {
  private constructor(
    private readonly _productRef: ProductRef,
    private readonly _quantity: Quantity,
  ) {}

  /**
   * @throws InvalidIdentifierException for a malformed product id
   * @throws InvalidQuantityException for a non-integer or out-of-range quantity
   */
  static create(input: OrderLineRequestInput): OrderLineRequest {
    return new OrderLineRequest(
      ProductRef.create(input.productId),
      Quantity.create(input.quantity),
    );
  }

  get productRef(): ProductRef {
    return this._productRef;
  }

  get quantity(): Quantity {
    return this._quantity;
  }
}
