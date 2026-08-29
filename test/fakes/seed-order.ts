import { Order } from '@/ordering/domain';
import type { InMemoryOrderWriteRepository } from './in-memory-order-write.repository';

/** Places one single-line order straight into the write fake and returns it. */
export const seedPlaced = async (
  orders: InMemoryOrderWriteRepository,
  customerId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
): Promise<Order> => {
  const order = Order.place({
    customerId,
    lines: [
      {
        productId: '00000000-0000-4000-8000-000000000001',
        sku: 'ESP-001',
        name: 'Espresso Machine',
        unitPriceMinorUnits: 24999,
        currency: 'EUR',
        quantity: 1,
      },
    ],
    shippingAddress: {
      recipientName: 'Ada Lovelace',
      line1: '1 Analytical Way',
      city: 'London',
      postalCode: 'N1 1AA',
      country: 'GB',
    },
  });
  await orders.place({ order, idempotencyKey: null });
  return order;
};
