import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  Email,
  OneTimeTokenId,
  SecretToken,
  TokenPurpose,
  UserId,
} from '@/identity/domain';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepository,
} from '../../../ports/credential.repository';
import { EMAIL_SENDER, type EmailSender } from '../../../ports/email.sender';
import {
  ONE_TIME_TOKEN_REPOSITORY,
  type OneTimeTokenRepository,
} from '../../../ports/one-time-token.repository';
import {
  TOKEN_LIFETIMES,
  type TokenLifetimes,
  resetExpiry,
} from '../../../token-lifetimes';
import { RequestPasswordResetCommand } from './request-password-reset.command';

/**
 * Issues a fresh reset token and mails it, unless the address does not exist.
 * Resolves the same way in every case: nothing distinguishes "no such
 * address" from "sent", because an endpoint that answers differently is an
 * account-existence oracle. Unlike `ResendVerificationHandler`, an unverified
 * account is still eligible: verification gates signing in, not recovering a
 * password.
 */
@CommandHandler(RequestPasswordResetCommand)
export class RequestPasswordResetHandler implements ICommandHandler<
  RequestPasswordResetCommand,
  void
> {
  private readonly logger = new Logger(RequestPasswordResetHandler.name);

  constructor(
    @Inject(ONE_TIME_TOKEN_REPOSITORY)
    private readonly tokens: OneTimeTokenRepository,
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepository,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(TOKEN_LIFETIMES) private readonly lifetimes: TokenLifetimes,
  ) {}

  async execute(command: RequestPasswordResetCommand): Promise<void> {
    const email = Email.create(command.email);
    const record = await this.credentials.findAuthentication(email);

    // 202 whether or not anything matched, so this cannot be used to probe
    // for accounts.
    if (!record) {
      return;
    }

    const secret = SecretToken.issue();

    await this.tokens.issue({
      id: OneTimeTokenId.create(),
      purpose: TokenPurpose.passwordReset(),
      userId: UserId.create(record.userId),
      tokenHash: secret.hash,
      expiresAt: resetExpiry(new Date(), this.lifetimes),
    });

    await this.send(email, secret.plaintext);
  }

  /**
   * Swallows a send failure on purpose, for the same reason
   * `ResendVerificationHandler` does: the token is already issued by this
   * point, so failing the request would report the opposite of what
   * happened, and the client's retry would issue yet another token rather
   * than recovering anything.
   */
  private async send(to: Email, token: string): Promise<void> {
    try {
      await this.email.sendPasswordReset(to, token);
    } catch (error) {
      this.logger.error(
        `Password reset email to ${to.value} was not accepted by the transport`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
