import type { Shortfall } from '@/catalogue/application';
import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * `kind: 'conflict'` surfaces as 409 with `details` naming every product that
 * fell short, its reason, and the stock on hand. Unknown products are
 * shortfalls too: from the customer's side, both mean "not for sale in that
 * quantity right now".
 */
export class StockUnavailableException extends ApplicationException {
  readonly code = 'ORDER_STOCK_UNAVAILABLE';
  readonly kind: ApplicationErrorKind = 'conflict';

  constructor(override readonly details: Shortfall[]) {
    super(
      `Stock is unavailable for ${details.length} product${details.length === 1 ? '' : 's'}.`,
    );
  }
}
