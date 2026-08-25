import type { OrderScope } from '../application';
import type { AuthenticatedUser } from '@/shared/presentation/authenticated-request';

// The one place the staff role name is defined in this context; the
// controller's `@Roles` decorators reference it too. `seller` is identity's
// word for staff (user-role.vo.ts); products have no owner, so a seller sees
// every order.
export const STAFF_ROLE = 'seller';

/** Turns the authenticated caller into ordering's own idea of who is asking. */
export function scopeOf(user: AuthenticatedUser): OrderScope {
  return user.role === STAFF_ROLE
    ? { kind: 'staff' }
    : { kind: 'customer', customerId: user.userId };
}
