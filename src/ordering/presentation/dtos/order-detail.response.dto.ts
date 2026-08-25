import type { OrderDetailReadModel } from '../../application';
import {
  OrderSummaryResponseDto,
  summaryFields,
} from './order-summary.response.dto';

export interface OrderLineResponse {
  productId: string;
  sku: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface ShippingAddressResponse {
  recipientName: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string;
  country: string;
}

/** The summary plus lines and address, lines with decimal prices. */
export class OrderDetailResponseDto extends OrderSummaryResponseDto {
  lines!: OrderLineResponse[];
  shippingAddress!: ShippingAddressResponse;

  static fromDetail(model: OrderDetailReadModel): OrderDetailResponseDto {
    const dto = Object.assign(
      new OrderDetailResponseDto(),
      summaryFields(model),
    );
    dto.lines = model.lines.map((line) => ({
      productId: line.productId,
      sku: line.sku,
      name: line.name,
      unitPrice: line.unitPriceMinorUnits / 100,
      quantity: line.quantity,
      lineTotal: line.lineTotalMinorUnits / 100,
    }));
    dto.shippingAddress = { ...model.shippingAddress };
    return dto;
  }
}
