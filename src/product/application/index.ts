import { CreateProductHandler } from './use-cases/commands/create-product/create-product.handler';
import { DeleteProductHandler } from './use-cases/commands/delete-product/delete-product.handler';
import { ListProductsHandler } from './use-cases/queries/list-products/list-products.handler';
import { GetProductHandler } from './use-cases/queries/get-product/get-product.handler';

export const commandHandlers = [CreateProductHandler, DeleteProductHandler];
export const queryHandlers = [ListProductsHandler, GetProductHandler];
