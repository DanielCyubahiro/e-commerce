import type { OrderScope } from '../../../order-scope';

export class CancelOrderCommand {
  constructor(
    public readonly orderId: string,
    public readonly scope: OrderScope,
  ) {}
}
