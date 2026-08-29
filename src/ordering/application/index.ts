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
export { DeliverOrderCommand } from './use-cases/commands/deliver-order/deliver-order.command';
export { DeliverOrderHandler } from './use-cases/commands/deliver-order/deliver-order.handler';
export { PayOrderCommand } from './use-cases/commands/pay-order/pay-order.command';
export { PayOrderHandler } from './use-cases/commands/pay-order/pay-order.handler';
export { PlaceOrderCommand } from './use-cases/commands/place-order/place-order.command';
export { PlaceOrderHandler } from './use-cases/commands/place-order/place-order.handler';
export { ShipOrderCommand } from './use-cases/commands/ship-order/ship-order.command';
export { ShipOrderHandler } from './use-cases/commands/ship-order/ship-order.handler';
export { GetOrderHandler } from './use-cases/queries/get-order/get-order.handler';
export { GetOrderQuery } from './use-cases/queries/get-order/get-order.query';
export { ListOrdersHandler } from './use-cases/queries/list-orders/list-orders.handler';
export { ListOrdersQuery } from './use-cases/queries/list-orders/list-orders.query';

import { CancelOrderHandler as CancelOrder } from './use-cases/commands/cancel-order/cancel-order.handler';
import { DeliverOrderHandler as DeliverOrder } from './use-cases/commands/deliver-order/deliver-order.handler';
import { PayOrderHandler as PayOrder } from './use-cases/commands/pay-order/pay-order.handler';
import { PlaceOrderHandler as PlaceOrder } from './use-cases/commands/place-order/place-order.handler';
import { ShipOrderHandler as ShipOrder } from './use-cases/commands/ship-order/ship-order.handler';
import { GetOrderHandler as GetOrder } from './use-cases/queries/get-order/get-order.handler';
import { ListOrdersHandler as ListOrders } from './use-cases/queries/list-orders/list-orders.handler';

export const commandHandlers = [
  PlaceOrder,
  CancelOrder,
  PayOrder,
  ShipOrder,
  DeliverOrder,
];
export const queryHandlers = [GetOrder, ListOrders];
