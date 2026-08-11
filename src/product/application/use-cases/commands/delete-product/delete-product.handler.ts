import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { DeleteProductCommand } from './delete-product.command';
import {
  PRODUCT_REPOSITORY,
  type ProductRepository,
} from '../../../ports/product.repository';
import { ProductId } from '../../../../domain/value-objects/product-id.vo';
import { ProductNotFoundException } from '../../../exceptions/product-not-found.exception';

@CommandHandler(DeleteProductCommand)
export class DeleteProductHandler implements ICommandHandler<DeleteProductCommand> {
  constructor(
    @Inject(PRODUCT_REPOSITORY)
    private readonly productRepository: ProductRepository,
  ) {}

  async execute(command: DeleteProductCommand): Promise<void> {
    const deleted = await this.productRepository.delete(
      ProductId.create(command.productId),
    );

    if (!deleted) {
      throw new ProductNotFoundException(command.productId);
    }
  }
}
