import type {
  OrderLineRequestInput,
  ShippingAddressInput,
} from '@/ordering/domain';

/**
 * `idempotencyKey` is `null` when the client sent none. It is not part of the
 * order: it describes how the request was delivered, and lives beside the
 * aggregate in the store, never inside it.
 */
export class PlaceOrderCommand {
  constructor(
    public readonly customerId: string,
    public readonly lines: OrderLineRequestInput[],
    public readonly shippingAddress: ShippingAddressInput,
    public readonly idempotencyKey: string | null,
  ) {}
}
