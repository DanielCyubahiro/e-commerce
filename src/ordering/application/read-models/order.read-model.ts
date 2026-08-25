import type { OrderStatusValue } from '@/ordering/domain';

/**
 * Deliberately not the aggregate: nothing here enforces an invariant, so the
 * query path never rehydrates an `Order`. Every `*MinorUnits` is the stored
 * integer; presentation converts. `number` is the store-assigned order
 * number, which the aggregate never sees.
 */
export interface OrderSummaryReadModel {
  id: string;
  number: number;
  customerId: string;
  status: OrderStatusValue;
  currency: string;
  subtotalMinorUnits: number;
  shippingFeeMinorUnits: number;
  taxMinorUnits: number;
  totalMinorUnits: number;
  lineCount: number;
  paidAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderLineReadModel {
  productId: string;
  sku: string;
  name: string;
  unitPriceMinorUnits: number;
  quantity: number;
  lineTotalMinorUnits: number;
}

export interface ShippingAddressReadModel {
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
}

/** The summary plus what only a single order's page shows. Lines come in product id order. */
export interface OrderDetailReadModel extends OrderSummaryReadModel {
  lines: OrderLineReadModel[];
  shippingAddress: ShippingAddressReadModel;
}
