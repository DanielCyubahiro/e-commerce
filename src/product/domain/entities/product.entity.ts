import { AggregateRoot } from '../../../shared/domain/aggregate-root';
import { Money } from '../../../shared/domain/value-objects/money.vo';
import { ProductId } from '../value-object/product-id.vo';
import { Sku } from '../value-object/sku.vo';

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

export class Product extends AggregateRoot {
  private _id: ProductId;
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
    super();
    this._id = props.id;
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

  static create(
    name: string,
    description: string,
    price: number,
    sku: string,
    stock: number,
  ): Product {
    Product.validateName(name);
    Product.validateStock(stock);
    const props: ProductProps = {
      id: new ProductId(),
      name,
      description,
      price: Money.create(price),
      sku: Sku.create(sku),
      stock,
      lowStockThreshold: 5,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return new Product(props);
  }

  private static validateName(name: string): void {
    if (!name || name.trim().length < 2) {
      throw new Error('Product name must be at least 2 characters long.');
    }
  }

  private static validateStock(stock: number): void {
    if (stock < 0) {
      throw new Error('Stock cannot be negative.');
    }
  }

  static reconstitute(props: ProductProps): Product {
    return new Product(props);
  }

  get id(): ProductId {
    return this._id;
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
