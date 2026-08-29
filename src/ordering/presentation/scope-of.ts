import type { OrderScope } from '../application';
import type { AuthenticatedUser } from '@/shared/presentation/authenticated-request';

// The one place a role name is spelled in this context. `seller` is identity's
// word for staff (user-role.vo.ts); products have no owner, so a seller sees
// every order.
const STAFF_ROLE = 'seller';

/** Turns the authenticated caller into ordering's own idea of who is asking. */
export function scopeOf(user: AuthenticatedUser): OrderScope {
  return user.role === STAFF_ROLE
    ? { kind: 'staff' }
    : { kind: 'customer', customerId: user.userId };
}
