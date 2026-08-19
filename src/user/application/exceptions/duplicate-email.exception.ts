import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * Raised by the write adapter when the store rejects a second user holding one
 * email. `kind: 'conflict'` surfaces as 409, distinct from the 422 an invalid
 * email shape gets from `Email.create`.
 */
export class DuplicateEmailException extends ApplicationException {
  readonly code = 'USER_EMAIL_DUPLICATE';
  readonly kind: ApplicationErrorKind = 'conflict';

  constructor(readonly email: string) {
    super(`A user with email "${email}" already exists.`);
  }
}
