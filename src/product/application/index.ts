import { CreateProductHandler } from './use-cases/commands/create-product/create-product.handler';
import { ListProductsHandler } from './use-cases/queries/list-products/list-product.handler';

export const commandHandlers = [CreateProductHandler];
export const queryHandlers = [ListProductsHandler];
