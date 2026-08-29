/** Staff only, enforced at the edge by `@Roles('seller')`; no scope needed. */
export class PayOrderCommand {
  constructor(public readonly orderId: string) {}
}
