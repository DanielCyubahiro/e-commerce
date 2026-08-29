import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * `kind: 'not-found'` surfaces as 404. Also the answer when the order exists
 * but belongs to another customer: an owner-scoped read cannot tell the two
 * apart, on purpose.
 */
export class OrderNotFoundException extends ApplicationException {
  readonly code = 'ORDER_NOT_FOUND';
  readonly kind: ApplicationErrorKind = 'not-found';

  constructor(readonly orderId: string) {
    super(`No order found with id "${orderId}".`);
  }
}
