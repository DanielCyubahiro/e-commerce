import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/** `kind: 'not-found'` surfaces as 404. */
export class UserNotFoundException extends ApplicationException {
  readonly code = 'USER_NOT_FOUND';
  readonly kind: ApplicationErrorKind = 'not-found';

  constructor(readonly userId: string) {
    super(`No user found with id "${userId}".`);
  }
}
