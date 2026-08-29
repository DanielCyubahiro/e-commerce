export { OrderConflictException } from './exceptions/order-conflict.exception';
export { OrderNotFoundException } from './exceptions/order-not-found.exception';
export { StockUnavailableException } from './exceptions/stock-unavailable.exception';
export { customerFilterOf, type OrderScope } from './order-scope';
export {
  ORDER_READ_REPOSITORY,
  type OrderFilters,
  type OrderReadRepository,
} from './ports/order.read-repository';
export {
  ORDER_WRITE_REPOSITORY,
  type OrderWriteRepository,
  type Placement,
  type PlaceOutcome,
  type SaveOutcome,
} from './ports/order.write-repository';
export type {
  OrderDetailReadModel,
  OrderLineReadModel,
  OrderSummaryReadModel,
  ShippingAddressReadModel,
} from './read-models/order.read-model';
export { CancelOrderCommand } from './use-cases/commands/cancel-order/cancel-order.command';
export { CancelOrderHandler } from './use-cases/commands/cancel-order/cancel-order.handler';
export { PlaceOrderCommand } from './use-cases/commands/place-order/place-order.command';
export { PlaceOrderHandler } from './use-cases/commands/place-order/place-order.handler';

import { CancelOrderHandler as CancelOrder } from './use-cases/commands/cancel-order/cancel-order.handler';
import { PlaceOrderHandler as PlaceOrder } from './use-cases/commands/place-order/place-order.handler';

export const commandHandlers = [PlaceOrder, CancelOrder];
