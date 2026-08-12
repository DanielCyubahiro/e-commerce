import { Product } from '../../domain/entities/product.entity';
import { ProductId } from '../../domain/value-objects/product-id.vo';
import { Sku } from '../../domain/value-objects/sku.vo';

export const PRODUCT_REPOSITORY = Symbol('PRODUCT_REPOSITORY');

export interface ProductFilters {
  minPrice?: number | undefined;
  maxPrice?: number | undefined;
  isActive?: boolean | undefined;
}

export interface ProductRepository {
  save(product: Product): Promise<void>;
  findById(id: ProductId): Promise<Product | null>;
  findBySku(sku: Sku): Promise<Product | null>;
  findMany(filters: ProductFilters): Promise<Product[]>;
  delete(id: ProductId): Promise<boolean>;
}
