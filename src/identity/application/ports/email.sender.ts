import type { Email } from '@/identity/domain';

export const EMAIL_SENDER = Symbol('EMAIL_SENDER');

/**
 * Takes a recipient and a raw token, never a subject or a body. The adapter
 * owns the copy and builds the link, so the application layer never knows what
 * a verification email looks like and a move to a provider with server-side
 * templates changes one file.
 *
 * Both methods resolve when the transport has accepted the message, which is
 * not the same as delivery. Callers treat a rejection as recoverable: every
 * flow that sends mail has an endpoint the user can trigger again.
 */
export interface EmailSender {
  sendEmailVerification(to: Email, token: string): Promise<void>;

  sendPasswordReset(to: Email, token: string): Promise<void>;
}
