import type { ProductReadModel } from '@/product/application';

/**
 * Not a pass-through over `ProductReadModel`: it converts stored minor units to
 * the decimal a client expects and timestamps to ISO strings. If the two ever
 * carry identical fields, this class has become forwarding and should go.
 */
export class ProductResponseDto {
  id!: string;
  name!: string;
  description!: string;
  price!: number;
  currency!: string;
  sku!: string;
  stock!: number;
  createdAt!: string;
  updatedAt!: string;

  /**
   * `priceMinorUnits` is the stored integer; turning it into the decimal a
   * client expects happens here, presentation's job and nowhere else's. See
   * "Read model" in docs/concepts.md.
   */
  static fromReadModel(model: ProductReadModel): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = model.id;
    dto.name = model.name;
    dto.description = model.description;
    dto.price = model.priceMinorUnits / 100;
    dto.currency = model.priceCurrency;
    dto.sku = model.sku;
    dto.stock = model.stock;
    dto.createdAt = model.createdAt.toISOString();
    dto.updatedAt = model.updatedAt.toISOString();
    return dto;
  }
}
