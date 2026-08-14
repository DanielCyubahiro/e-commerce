/**
 * Deliberately not the aggregate. Nothing here enforces an invariant, so the
 * query path never rehydrates a `Product`, which is what lets the aggregate keep
 * its persistence factory private.
 *
 * `priceMinorUnits` is the stored integer; converting it to a decimal is the
 * presentation layer's job.
 */
export interface ProductReadModel {
  id: string;
  name: string;
  description: string;
  priceMinorUnits: number;
  priceCurrency: string;
  sku: string;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}
