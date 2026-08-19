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
  verificationExpiry,
} from '../../../token-lifetimes';
import { ResendVerificationCommand } from './resend-verification.command';

/**
 * Issues a fresh verification token and mails it, unless the address does not
 * exist or is already verified. Resolves the same way in every case: nothing
 * distinguishes "no such address" from "already verified" from "sent",
 * because an endpoint that answers differently is an account-existence
 * oracle.
 */
@CommandHandler(ResendVerificationCommand)
export class ResendVerificationHandler implements ICommandHandler<
  ResendVerificationCommand,
  void
> {
  private readonly logger = new Logger(ResendVerificationHandler.name);

  constructor(
    @Inject(ONE_TIME_TOKEN_REPOSITORY)
    private readonly tokens: OneTimeTokenRepository,
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepository,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(TOKEN_LIFETIMES) private readonly lifetimes: TokenLifetimes,
  ) {}

  async execute(command: ResendVerificationCommand): Promise<void> {
    const email = Email.create(command.email);
    const record = await this.credentials.findAuthentication(email);

    if (!record || record.emailVerifiedAt !== null) {
      return;
    }

    const secret = SecretToken.issue();

    await this.tokens.issue({
      id: OneTimeTokenId.create(),
      purpose: TokenPurpose.emailVerification(),
      userId: UserId.create(record.userId),
      tokenHash: secret.hash,
      expiresAt: verificationExpiry(new Date(), this.lifetimes),
    });

    await this.send(email, secret.plaintext);
  }

  /**
   * Swallows a send failure on purpose, for the same reason
   * `RegisterUserHandler` does: the token is already issued by this point, so
   * failing the request would report the opposite of what happened, and the
   * client's retry would issue yet another token rather than recovering
   * anything.
   */
  private async send(to: Email, token: string): Promise<void> {
    try {
      await this.email.sendEmailVerification(to, token);
    } catch (error) {
      this.logger.error(
        `Verification email to ${to.value} was not accepted by the transport`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
