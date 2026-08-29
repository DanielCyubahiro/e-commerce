import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * `kind: 'conflict'` surfaces as 409: the order moved between being loaded and
 * being saved. The client re-reads and decides again.
 */
export class OrderConflictException extends ApplicationException {
  readonly code = 'ORDER_CONFLICT';
  readonly kind: ApplicationErrorKind = 'conflict';

  constructor(readonly orderId: string) {
    super(`Order "${orderId}" was changed by someone else; reload and retry.`);
  }
}
