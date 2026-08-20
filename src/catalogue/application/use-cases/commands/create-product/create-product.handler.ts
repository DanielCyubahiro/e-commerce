import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Product } from '@/catalogue/domain';
import {
  PRODUCT_WRITE_REPOSITORY,
  type ProductWriteRepository,
} from '../../../ports/product.write-repository';
import { CreateProductCommand } from './create-product.command';

/**
 * Constructs the aggregate, which validates name, description, and stock, then
 * delegates SKU uniqueness to `ProductWriteRepository.add`. No read-then-write
 * check happens here; the store is the sole arbiter of uniqueness.
 */
@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<
  CreateProductCommand,
  string
> {
  constructor(
    @Inject(PRODUCT_WRITE_REPOSITORY)
    private readonly productRepository: ProductWriteRepository,
  ) {}

  /** @returns the new product's id */
  async execute(command: CreateProductCommand): Promise<string> {
    const product = Product.create({
      name: command.name,
      description: command.description,
      price: command.price,
      currency: command.currency,
      sku: command.sku,
      stock: command.stock,
    });

    await this.productRepository.add(product);

    return product.id.value;
  }
}
