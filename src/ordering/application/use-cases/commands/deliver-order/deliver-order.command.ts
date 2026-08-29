/** Staff only, enforced at the edge by `@Roles('seller')`; no scope needed. */
export class DeliverOrderCommand {
  constructor(public readonly orderId: string) {}
}
