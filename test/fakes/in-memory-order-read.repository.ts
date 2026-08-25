import type {
  OrderDetailReadModel,
  OrderFilters,
  OrderReadRepository,
  OrderSummaryReadModel,
} from '@/ordering/application';
import type { OrderId } from '@/ordering/domain';
import type { Page, Pagination } from '@/shared/application';
import type {
  InMemoryOrderWriteRepository,
  StoredOrder,
} from './in-memory-order-write.repository';

const EPOCH = Date.parse('2026-01-01T00:00:00.000Z');

/**
 * Reads from whatever the paired write fake holds, applying the same filters,
 * ordering, and paging the Drizzle adapter applies. The write fake's sequences
 * stand in for the clock, as the product read fake's do.
 */
export class InMemoryOrderReadRepository implements OrderReadRepository {
  constructor(private readonly writes: InMemoryOrderWriteRepository) {}

  findById(
    id: OrderId,
    customerId?: string,
  ): Promise<OrderDetailReadModel | null> {
    const row = this.writes
      .stored()
      .find(
        (stored) =>
          stored.order.id.value === id.value &&
          (customerId === undefined ||
            stored.order.customerId.value === customerId),
      );

    return Promise.resolve(
      row ? InMemoryOrderReadRepository.detail(row) : null,
    );
  }

  findMany(
    filters: OrderFilters,
    page: Pagination,
  ): Promise<Page<OrderSummaryReadModel>> {
    const matching = this.writes
      .stored()
      .filter(
        (stored) =>
          filters.status === undefined ||
          stored.order.status.value === filters.status,
      )
      .filter(
        (stored) =>
          filters.customerId === undefined ||
          stored.order.customerId.value === filters.customerId,
      )
      .map((stored) => InMemoryOrderReadRepository.summary(stored))
      .sort(
        (left, right) =>
          right.createdAt.getTime() - left.createdAt.getTime() ||
          right.id.localeCompare(left.id),
      );

    return Promise.resolve({
      items: matching.slice(page.offset, page.offset + page.limit),
      total: matching.length,
      limit: page.limit,
      offset: page.offset,
    });
  }

  private static summary(stored: StoredOrder): OrderSummaryReadModel {
    const { order } = stored;

    return {
      id: order.id.value,
      number: stored.number,
      customerId: order.customerId.value,
      status: order.status.value,
      currency: order.total.currency,
      subtotalMinorUnits: order.subtotal.minorUnits,
      shippingFeeMinorUnits: order.shippingFee.minorUnits,
      taxMinorUnits: order.tax.minorUnits,
      totalMinorUnits: order.total.minorUnits,
      lineCount: order.lines.length,
      paidAt: order.paidAt,
      shippedAt: order.shippedAt,
      deliveredAt: order.deliveredAt,
      cancelledAt: order.cancelledAt,
      createdAt: new Date(EPOCH + stored.createdSeq * 1000),
      updatedAt: new Date(EPOCH + stored.updatedSeq * 1000),
    };
  }

  private static detail(stored: StoredOrder): OrderDetailReadModel {
    const address = stored.order.shippingAddress;

    return {
      ...InMemoryOrderReadRepository.summary(stored),
      lines: [...stored.order.lines]
        .sort((left, right) =>
          left.productRef.value.localeCompare(right.productRef.value),
        )
        .map((line) => ({
          productId: line.productRef.value,
          sku: line.sku,
          name: line.name,
          unitPriceMinorUnits: line.unitPrice.minorUnits,
          quantity: line.quantity.value,
          lineTotalMinorUnits: line.lineTotal.minorUnits,
        })),
      shippingAddress: {
        recipientName: address.recipientName,
        line1: address.line1,
        line2: address.line2,
        city: address.city,
        region: address.region,
        postalCode: address.postalCode,
        country: address.country,
      },
    };
  }
}
