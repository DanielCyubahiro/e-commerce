import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { ProductId } from '@/catalogue/domain';
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

  /**
   * `ProductWriteRepository.delete` returns false rather than throwing when no
   * product holds that id; turning that into `ProductNotFoundException`
   * happens here.
   */
  async execute(command: DeleteProductCommand): Promise<void> {
    const deleted = await this.productRepository.delete(
      ProductId.create(command.productId),
    );

    if (!deleted) {
      throw new ProductNotFoundException(command.productId);
    }
  }
}
