import type { Pagination } from '@/shared/application';
import type { OrderScope } from '../../../order-scope';

/** `status` is the caller's raw string; parsing it through `OrderStatus` happens in the handler. */
export class ListOrdersQuery {
  constructor(
    public readonly filters: {
      status?: string | undefined;
      customerId?: string | undefined;
    },
    public readonly scope: OrderScope,
    public readonly pagination: Pagination,
  ) {}
}
