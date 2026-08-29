import type { OrderSummaryReadModel } from '../../application';

/** `ORD-` plus the number zero-padded to six digits; wider numbers simply grow. */
export const formatOrderNumber = (number: number): string =>
  `ORD-${String(number).padStart(6, '0')}`;

const toDecimal = (minorUnits: number): number => minorUnits / 100;
const toIso = (date: Date | null): string | null =>
  date === null ? null : date.toISOString();

/**
 * Not a pass-through over `OrderSummaryReadModel`: minor units become decimals,
 * dates become ISO strings, and the number gains its prefix, all here and
 * nowhere else.
 */
export class OrderSummaryResponseDto {
  id!: string;
  number!: string;
  customerId!: string;
  status!: string;
  currency!: string;
  subtotal!: number;
  shippingFee!: number;
  tax!: number;
  total!: number;
  lineCount!: number;
  paidAt!: string | null;
  shippedAt!: string | null;
  deliveredAt!: string | null;
  cancelledAt!: string | null;
  createdAt!: string;
  updatedAt!: string;

  static fromReadModel(model: OrderSummaryReadModel): OrderSummaryResponseDto {
    return Object.assign(new OrderSummaryResponseDto(), summaryFields(model));
  }
}

/** Shared with the detail DTO so the two cannot drift on a field. */
export function summaryFields(
  model: OrderSummaryReadModel,
): OrderSummaryResponseDto {
  const dto = new OrderSummaryResponseDto();
  dto.id = model.id;
  dto.number = formatOrderNumber(model.number);
  dto.customerId = model.customerId;
  dto.status = model.status;
  dto.currency = model.currency;
  dto.subtotal = toDecimal(model.subtotalMinorUnits);
  dto.shippingFee = toDecimal(model.shippingFeeMinorUnits);
  dto.tax = toDecimal(model.taxMinorUnits);
  dto.total = toDecimal(model.totalMinorUnits);
  dto.lineCount = model.lineCount;
  dto.paidAt = toIso(model.paidAt);
  dto.shippedAt = toIso(model.shippedAt);
  dto.deliveredAt = toIso(model.deliveredAt);
  dto.cancelledAt = toIso(model.cancelledAt);
  dto.createdAt = model.createdAt.toISOString();
  dto.updatedAt = model.updatedAt.toISOString();
  return dto;
}
