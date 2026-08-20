import type { EmailSender } from '@/identity/application';
import type { Email } from '@/identity/domain';

export interface RecordedMessage {
  to: string;
  subject: string;
  body: string;
}

/**
 * A fake, not a mock: handler tests assert what was sent, never that a method
 * was called. Its copy is intentionally minimal, since the contract suite
 * checks only what both implementations must agree on.
 */
export class RecordingEmailSender implements EmailSender {
  private readonly messages: RecordedMessage[] = [];

  sendEmailVerification(to: Email, token: string): Promise<void> {
    this.messages.push({
      to: to.value,
      subject: 'Verify your email address',
      body: `verify with ${token}`,
    });

    return Promise.resolve();
  }

  sendPasswordReset(to: Email, token: string): Promise<void> {
    this.messages.push({
      to: to.value,
      subject: 'Reset your password',
      body: `reset with ${token}`,
    });

    return Promise.resolve();
  }

  sent(): RecordedMessage[] {
    return [...this.messages];
  }

  clear(): void {
    this.messages.length = 0;
  }
}
