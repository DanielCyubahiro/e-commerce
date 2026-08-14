import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ProductId } from '@/product/domain';
import { ProductNotFoundException } from '../../../exceptions/product-not-found.exception';
import {
  PRODUCT_WRITE_REPOSITORY,
  type ProductWriteRepository,
} from '../../../ports/product.write-repository';
import { DeleteProductCommand } from './delete-product.command';

@CommandHandler(DeleteProductCommand)
export class DeleteProductHandler implements ICommandHandler<
  DeleteProductCommand,
  void
> {
  constructor(
    @Inject(PRODUCT_WRITE_REPOSITORY)
    private readonly productRepository: ProductWriteRepository,
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
