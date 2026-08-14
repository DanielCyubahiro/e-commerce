export { DuplicateSkuException } from './exceptions/duplicate-sku.exception';
export { ProductNotFoundException } from './exceptions/product-not-found.exception';
export {
  PRODUCT_READ_REPOSITORY,
  type ProductFilters,
  type ProductReadRepository,
} from './ports/product.read-repository';
export {
  PRODUCT_WRITE_REPOSITORY,
  type ProductWriteRepository,
} from './ports/product.write-repository';
export type { ProductReadModel } from './read-models/product.read-model';
export { CreateProductCommand } from './use-cases/commands/create-product/create-product.command';
export { CreateProductHandler } from './use-cases/commands/create-product/create-product.handler';
export { DeleteProductCommand } from './use-cases/commands/delete-product/delete-product.command';
export { DeleteProductHandler } from './use-cases/commands/delete-product/delete-product.handler';
export { GetProductHandler } from './use-cases/queries/get-product/get-product.handler';
export { GetProductQuery } from './use-cases/queries/get-product/get-product.query';
export { ListProductsHandler } from './use-cases/queries/list-products/list-products.handler';
export { ListProductsQuery } from './use-cases/queries/list-products/list-products.query';

import { CreateProductHandler as CreateProduct } from './use-cases/commands/create-product/create-product.handler';
import { DeleteProductHandler as DeleteProduct } from './use-cases/commands/delete-product/delete-product.handler';
import { GetProductHandler as GetProduct } from './use-cases/queries/get-product/get-product.handler';
import { ListProductsHandler as ListProducts } from './use-cases/queries/list-products/list-products.handler';

export const commandHandlers = [CreateProduct, DeleteProduct];
export const queryHandlers = [ListProducts, GetProduct];
