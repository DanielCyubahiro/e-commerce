import { Inject, Logger } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  type Email,
  OneTimeTokenId,
  Password,
  SecretToken,
  User,
} from '@/identity/domain';
import { EMAIL_SENDER, type EmailSender } from '../../../ports/email.sender';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../../ports/password-hasher';
import {
  USER_WRITE_REPOSITORY,
  type UserWriteRepository,
} from '../../../ports/user.write-repository';
import {
  TOKEN_LIFETIMES,
  type TokenLifetimes,
  verificationExpiry,
} from '../../../token-lifetimes';
import { RegisterUserCommand } from './register-user.command';

/**
 * Validates the password, hashes it, then writes the account and its first
 * verification token in one transaction, and only afterwards sends the email.
 *
 * The order is load-bearing in both directions: hashing before the write means
 * a policy rejection costs nothing, and sending after the commit means a
 * rolled-back transaction can never mail a link to a token that does not exist.
 */
@CommandHandler(RegisterUserCommand)
export class RegisterUserHandler implements ICommandHandler<
  RegisterUserCommand,
  string
> {
  private readonly logger = new Logger(RegisterUserHandler.name);

  constructor(
    @Inject(USER_WRITE_REPOSITORY)
    private readonly users: UserWriteRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(EMAIL_SENDER) private readonly email: EmailSender,
    @Inject(TOKEN_LIFETIMES) private readonly lifetimes: TokenLifetimes,
  ) {}

  /** @returns the new user's id */
  async execute(command: RegisterUserCommand): Promise<string> {
    const passwordHash = await this.hasher.hash(
      Password.create(command.password),
    );
    const user = User.create(command.fields);
    const verification = SecretToken.issue();

    await this.users.register({
      user,
      passwordHash,
      verification: {
        id: OneTimeTokenId.create(),
        tokenHash: verification.hash,
        expiresAt: verificationExpiry(new Date(), this.lifetimes),
      },
    });

    await this.sendVerification(user.email, verification.plaintext);

    return user.id.value;
  }

  /**
   * Swallows a send failure on purpose. The account is committed by this point,
   * so failing the request would report the opposite of what happened and the
   * client's retry would answer 409. The user's recovery path is
   * `POST /auth/verify-email/resend`.
   */
  private async sendVerification(to: Email, token: string): Promise<void> {
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
