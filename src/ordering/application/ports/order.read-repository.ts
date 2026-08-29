import type { OrderId, OrderStatusValue } from '@/ordering/domain';
import type { Page, Pagination } from '@/shared/application';
import type {
  OrderDetailReadModel,
  OrderSummaryReadModel,
} from '../read-models/order.read-model';

export const ORDER_READ_REPOSITORY = Symbol('ORDER_READ_REPOSITORY');

/**
 * `status` is already a parsed `OrderStatusValue`: `ListOrdersHandler` runs
 * the raw string through `OrderStatus.create`, so no implementation has to
 * know the closed set. `customerId` is a plain string filter; scoping it is
 * the handler's job too.
 */
export interface OrderFilters {
  status?: OrderStatusValue | undefined;
  customerId?: string | undefined;
}

export interface OrderReadRepository {
  /**
   * @param customerId when given, an order another customer placed answers
   * `null` exactly like a missing one; the handler turns that into 404
   */
  findById(
    id: OrderId,
    customerId?: string,
  ): Promise<OrderDetailReadModel | null>;

  /** Newest first, ordered by `created_at DESC, id DESC` so paging is total. */
  findMany(
    filters: OrderFilters,
    page: Pagination,
  ): Promise<Page<OrderSummaryReadModel>>;
}
