import { AggregateRoot, Money } from '@/shared/domain';
import { InvalidProductDescriptionException } from '../exceptions/invalid-product-description.exception';
import { InvalidProductNameException } from '../exceptions/invalid-product-name.exception';
import { InvalidStockException } from '../exceptions/invalid-stock.exception';
import { ProductId } from '../value-objects/product-id.vo';
import { Sku } from '../value-objects/sku.vo';

export interface CreateProductInput {
  name: string;
  description: string;
  price: number;
  currency: string;
  sku: string;
  stock: number;
}

export interface ProductProps {
  id: ProductId;
  name: string;
  description: string;
  price: Money;
  sku: Sku;
  stock: number;
  lowStockThreshold: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Product extends AggregateRoot<ProductId> {
  private static readonly MIN_NAME_LENGTH = 2;
  private static readonly MAX_NAME_LENGTH = 255;

  private _name: string;
  private _description: string;
  private _price: Money;
  private _sku: Sku;
  private _stock: number;
  private _lowStockThreshold: number;
  private _isActive: boolean;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(props: ProductProps) {
    super(props.id);
    this._name = props.name;
    this._description = props.description;
    this._price = props.price;
    this._sku = props.sku;
    this._stock = props.stock;
    this._lowStockThreshold = props.lowStockThreshold;
    this._isActive = props.isActive;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  /**
   * Takes one object rather than positional arguments because four of the six
   * fields are strings, so `create(name, description, price, currency, sku,
   * stock)` accepts `sku` and `currency` transposed without complaint.
   */
  static create(input: CreateProductInput): Product {
    const name = input.name.trim();
    const description = input.description.trim();

    Product.validateName(name);
    Product.validateDescription(description);
    Product.validateStock(input.stock);

    const now = new Date();

    return new Product({
      id: ProductId.create(),
      name,
      description,
      price: Money.fromDecimal(input.price, input.currency),
      sku: Sku.create(input.sku),
      stock: input.stock,
      lowStockThreshold: 5,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: ProductProps): Product {
    return new Product(props);
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

  get lowStockThreshold(): number {
    return this._lowStockThreshold;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }
}
