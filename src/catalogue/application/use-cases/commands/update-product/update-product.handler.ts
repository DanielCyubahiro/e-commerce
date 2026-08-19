import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Product, ProductId } from '@/catalogue/domain';
import { ProductNotFoundException } from '../../../exceptions/product-not-found.exception';
import {
  PRODUCT_WRITE_REPOSITORY,
  type ProductWriteRepository,
} from '../../../ports/product.write-repository';
import { UpdateProductCommand } from './update-product.command';

/**
 * Builds the replacement aggregate, which validates every invariant, then hands
 * it to the port. Construction happens before the store is touched, so an
 * invalid payload aimed at an id that holds nothing surfaces as the invariant
 * failure, not as a missing product.
 */
@CommandHandler(UpdateProductCommand)
export class UpdateProductHandler implements ICommandHandler<
  UpdateProductCommand,
  void
> {
  constructor(
    @Inject(PRODUCT_WRITE_REPOSITORY)
    private readonly productRepository: ProductWriteRepository,
  ) {}

  /**
   * `ProductWriteRepository.replace` returns false rather than throwing when no
   * product holds that id; turning that into `ProductNotFoundException` happens
   * here, exactly as in `DeleteProductHandler`.
   */
  async execute(command: UpdateProductCommand): Promise<void> {
    const product = Product.replace(
      ProductId.create(command.productId),
      command.fields,
    );

    const replaced = await this.productRepository.replace(product);

    if (!replaced) {
      throw new ProductNotFoundException(command.productId);
    }
  }
}
