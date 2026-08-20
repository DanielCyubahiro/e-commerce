import {
  type ApplicationErrorKind,
  ApplicationException,
} from '@/shared/application';

/**
 * The single answer to every way login can fail on identity: unknown address,
 * wrong password, or a credential row that is somehow missing. One code and one
 * message, because any difference between them tells an attacker which
 * addresses have accounts.
 */
export class InvalidCredentialsException extends ApplicationException {
  readonly code = 'AUTH_INVALID_CREDENTIALS';
  readonly kind: ApplicationErrorKind = 'unauthorized';

  constructor() {
    super('Email or password is incorrect.');
  }
}
