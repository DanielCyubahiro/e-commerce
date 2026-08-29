/**
 * Who is asking, in ordering's own terms. Presentation derives it from the
 * caller's role in one place (`scopeOf`); commands and queries carry it.
 * Customer scope forces the caller's own id onto every read and write, so
 * another customer's order is indistinguishable from a nonexistent one. Staff
 * scope reads anything and may filter by customer.
 */
export type OrderScope =
  { kind: 'customer'; customerId: string } | { kind: 'staff' };

/** The customer filter a read must apply under `scope`: the caller's own id, or nothing for staff. */
export const customerFilterOf = (scope: OrderScope): string | undefined =>
  scope.kind === 'customer' ? scope.customerId : undefined;
