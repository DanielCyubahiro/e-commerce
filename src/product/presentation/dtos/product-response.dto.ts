import { type Product } from '../../domain/entities/product.entity';

export class ProductResponseDto {
  id!: string;
  name!: string;
  description!: string;
  price!: number;
  sku!: string;
  stock!: number;
  currency?: string;
  lowStockThreshold!: number;
  isActive!: boolean;
  createdAt!: string;
  updatedAt!: string;

  static fromDomain(product: Product): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id.value;
    dto.name = product.name;
    dto.description = product.description;
    dto.price = product.price.amount;
    dto.sku = product.sku.value;
    dto.stock = product.stock;
    dto.currency = product.price.currency;
    dto.lowStockThreshold = product.lowStockThreshold;
    dto.isActive = product.isActive;
    dto.createdAt = product.createdAt.toISOString();
    dto.updatedAt = product.updatedAt.toISOString();
    return dto;
  }
}
