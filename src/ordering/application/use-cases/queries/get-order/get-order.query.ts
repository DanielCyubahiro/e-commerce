import type { OrderScope } from '../../../order-scope';

export class GetOrderQuery {
  constructor(
    public readonly orderId: string,
    public readonly scope: OrderScope,
  ) {}
}
