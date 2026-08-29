import {
  type ApplicationErrorKind,
  ApplicationException,
} from '../application-exception.base';

/**
 * Raised by `RolesGuard` when the caller is authenticated but holds none of
 * the roles an endpoint lists. `kind: 'forbidden'` surfaces as 403.
 */
export class InsufficientRoleException extends ApplicationException {
  readonly code = 'AUTH_ROLE_FORBIDDEN';
  readonly kind: ApplicationErrorKind = 'forbidden';

  constructor(readonly required: readonly string[]) {
    super(`This action requires one of the roles: ${required.join(', ')}.`);
  }
}
