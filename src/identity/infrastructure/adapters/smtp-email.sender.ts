import { Injectable } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import type { EmailSender } from '@/identity/application';
import type { Email } from '@/identity/domain';

export interface SmtpSettings {
  host: string;
  port: number;
  from: string;
  /** Where a frontend would receive the link. No trailing slash. */
  webBaseUrl: string;
}

/**
 * The only place mail copy and link shapes exist. Links point at
 * `webBaseUrl`, not at this API: both flows finish with a POST carrying the
 * token, because a GET that consumes a token gets consumed by link
 * prefetchers and mail scanners before the user clicks.
 *
 * No authentication, and `secure: false`: Mailpit accepts neither. Pointing
 * this at a provider means adding credentials here and to the environment
 * schema, which is a code change by design, since every declared variable in
 * this repo is required at boot.
 */
@Injectable()
export class SmtpEmailSender implements EmailSender {
  private readonly transport: Transporter;

  constructor(private readonly settings: SmtpSettings) {
    this.transport = createTransport({
      host: settings.host,
      port: settings.port,
      secure: false,
    });
  }

  async sendEmailVerification(to: Email, token: string): Promise<void> {
    await this.send(
      to,
      'Verify your email address',
      [
        'Confirm your email address to finish setting up your account.',
        '',
        `${this.settings.webBaseUrl}/verify-email?token=${encodeURIComponent(token)}`,
        '',
        'The link is valid for 24 hours.',
      ].join('\n'),
    );
  }

  async sendPasswordReset(to: Email, token: string): Promise<void> {
    await this.send(
      to,
      'Reset your password',
      [
        'Use this link to choose a new password.',
        '',
        `${this.settings.webBaseUrl}/reset-password?token=${encodeURIComponent(token)}`,
        '',
        'The link is valid for 1 hour. If you did not ask for it, ignore this email.',
      ].join('\n'),
    );
  }

  private async send(to: Email, subject: string, text: string): Promise<void> {
    await this.transport.sendMail({
      from: this.settings.from,
      to: to.value,
      subject,
      text,
    });
  }
}
