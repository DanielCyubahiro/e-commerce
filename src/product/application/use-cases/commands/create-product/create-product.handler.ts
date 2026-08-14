import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateProductCommand } from './create-product.command';
import { Inject } from '@nestjs/common';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../../ports/product.repository';
import { Product } from '../../../../domain/entities/product.entity';
import { DuplicateSkuException } from '../../../exceptions/duplicate-sku.exception';

@CommandHandler(CreateProductCommand)
export class CreateProductHandler implements ICommandHandler<CreateProductCommand> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(command: CreateProductCommand): Promise<void> {
    const product = Product.create({
      name: command.name,
      description: command.description,
      price: command.price,
      currency: command.currency ?? 'EUR',
      sku: command.sku,
      stock: command.stock,
    });

    const skuOwner = await this.productRepository.findBySku(product.sku);

    if (skuOwner) {
      throw new DuplicateSkuException(product.sku.value);
    }

    await this.productRepository.save(product);
  }
}
