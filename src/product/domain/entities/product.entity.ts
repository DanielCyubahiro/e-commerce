import { AggregateRoot, Money } from '@/shared/domain';
import { InvalidProductDescriptionException } from '../exceptions/invalid-product-description.exception';
import { InvalidProductNameException } from '../exceptions/invalid-product-name.exception';
import { InvalidStockException } from '../exceptions/invalid-stock.exception';
import { ProductId } from '../value-objects/product-id.vo';
import { Sku } from '../value-objects/sku.vo';

export interface ProductInput {
  name: string;
  description: string;
  price: number;
  currency: string;
  sku: string;
  stock: number;
}

interface ProductState {
  id: ProductId;
  name: string;
  description: string;
  price: Money;
  sku: Sku;
  stock: number;
}

/**
 * The consistency boundary for a product: every invariant (name, description,
 * stock) is validated in `build`, the one path both `create` and `replace`
 * take, and is never re-checked by callers downstream.
 */
export class Product extends AggregateRoot<ProductId> {
  private static readonly MIN_NAME_LENGTH = 2;
  private static readonly MAX_NAME_LENGTH = 255;

  private _name: string;
  private _description: string;
  private _price: Money;
  private _sku: Sku;
  private _stock: number;

  private constructor(state: ProductState) {
    super(state.id);
    this._name = state.name;
    this._description = state.description;
    this._price = state.price;
    this._sku = state.sku;
    this._stock = state.stock;
  }

  /**
   * Takes one object rather than positional arguments because four of the six
   * fields are strings, so `create(name, description, price, currency, sku,
   * stock)` accepts `sku` and `currency` transposed without complaint.
   */
  static create(input: ProductInput): Product {
    return Product.build(ProductId.create(), input);
  }

  /**
   * Full replacement of a product's state under an identity the caller already
   * holds, for example one parsed from a request path. Validates exactly what
   * `create` validates, so no unvalidated `Product` becomes representable.
   * Constructs a replacement; it does not persist one.
   */
  static replace(id: ProductId, input: ProductInput): Product {
    return Product.build(id, input);
  }

  private static build(id: ProductId, input: ProductInput): Product {
    const name = input.name.trim();
    const description = input.description.trim();

    Product.validateName(name);
    Product.validateDescription(description);
    Product.validateStock(input.stock);

    return new Product({
      id,
      name,
      description,
      price: Money.fromDecimal(input.price, input.currency),
      sku: Sku.create(input.sku),
      stock: input.stock,
    });
  }

  private static validateName(name: string): void {
    if (name.length < Product.MIN_NAME_LENGTH) {
      throw InvalidProductNameException.tooShort(Product.MIN_NAME_LENGTH);
    }
    if (name.length > Product.MAX_NAME_LENGTH) {
      throw InvalidProductNameException.tooLong(Product.MAX_NAME_LENGTH);
    }
  }

  private static validateDescription(description: string): void {
    if (description.length === 0) {
      throw InvalidProductDescriptionException.empty();
    }
  }

  private static validateStock(stock: number): void {
    if (!Number.isInteger(stock)) {
      throw InvalidStockException.notAnInteger(stock);
    }
    if (stock < 0) {
      throw InvalidStockException.negative(stock);
    }
  }

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get price(): Money {
    return this._price;
  }

  get sku(): Sku {
    return this._sku;
  }

  get stock(): number {
    return this._stock;
  }
}
