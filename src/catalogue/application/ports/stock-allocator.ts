import type { Transaction } from '@/shared/application';

export const STOCK_ALLOCATOR = Symbol('STOCK_ALLOCATOR');

/** Precondition: `quantity` is a positive integer. The caller's domain owns that rule. */
export interface AllocationRequest {
  productId: string;
  quantity: number;
}

/**
 * What was taken from stock, with the product as it was at that instant. The
 * snapshot travels with the allocation so the price a customer is charged is
 * the price at the moment their units were reserved, in one statement.
 */
export interface AllocatedLine {
  productId: string;
  sku: string;
  name: string;
  unitPriceMinorUnits: number;
  currency: string;
  quantity: number;
}

/** `available` is the stock on hand for `insufficient`, and `null` for `unknown`. */
export interface Shortfall {
  productId: string;
  reason: 'unknown' | 'insufficient';
  available: number | null;
}

/**
 * Closed and exact: a caller narrows on `kind`, never by casting, so a member
 * added here without a matching case is a compile error.
 */
export type AllocationOutcome =
  | { kind: 'allocated'; lines: AllocatedLine[] }
  | { kind: 'rejected'; shortfalls: Shortfall[] };

/**
 * The canonical processing order for both `allocate` and `release`. Two
 * concurrent orders touching the same products lock rows in the same sequence
 * and so cannot deadlock. Exported so the fake and the adapter agree, and so
 * a contract can assert the order `lines` come back in.
 */
export const inProductIdOrder = (
  requests: readonly AllocationRequest[],
): AllocationRequest[] =>
  [...requests].sort((left, right) =>
    left.productId.localeCompare(right.productId),
  );

/**
 * Catalogue's one published capability: ordering consumes it, nothing else in
 * catalogue does. Both methods take the caller's transaction because their
 * writes must commit or roll back with the caller's own.
 */
export interface StockAllocator {
  /**
   * Decrements each product's stock by its quantity in one guarded statement
   * per request, and returns the product snapshot with each decrement. Every
   * request is attempted so a rejection names every shortfall, not the first;
   * the partial decrements made before a shortfall are undone by the caller's
   * rollback, which is why `tx` is required rather than optional.
   */
  allocate(
    requests: AllocationRequest[],
    tx: Transaction,
  ): Promise<AllocationOutcome>;

  /**
   * Adds each quantity back. A product id nothing holds is skipped without
   * error: a deleted product has no stock to receive.
   */
  release(requests: AllocationRequest[], tx: Transaction): Promise<void>;
}
