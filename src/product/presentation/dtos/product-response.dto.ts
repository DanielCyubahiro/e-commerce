import { Product } from '../../domain/entities/product.entity';

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
    dto.id = product.id.getValue();
    dto.name = product.name;
    dto.description = product.description;
    dto.price = product.price.getAmount();
    dto.sku = product.sku.getValue();
    dto.stock = product.stock;
    dto.currency = product.price.getCurrency();
    dto.lowStockThreshold = product.lowStockThreshold;
    dto.isActive = product.isActive;
    dto.createdAt = product.createdAt.toISOString();
    dto.updatedAt = product.updatedAt.toISOString();
    return dto;
  }
}
