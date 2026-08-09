import { Money } from '../../../shared/domain/value-objects/money.vo';
import { Product } from '../../domain/entities/product.entity';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { Sku } from '../../domain/value-objects/sku.vo';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductFilters {
  minPrice?: Money;
  maxPrice?: Money;
  isActive?: boolean;
}

export interface ProductRepository {
  save(product: Product): Promise<void>;
  findById(id: ProductId): Promise<Product | null>;
  findBySku(sku: Sku): Promise<Product | null>;
  findAll(productFilters: ProductFilters): Promise<Product[]>;
}
