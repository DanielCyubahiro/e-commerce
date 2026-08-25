import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { Password, SecretToken, TokenPurpose, UserId } from '@/identity/domain';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepository,
} from '../../../ports/credential.repository';
import {
  ONE_TIME_TOKEN_REPOSITORY,
  type OneTimeTokenRepository,
} from '../../../ports/one-time-token.repository';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../../ports/password-hasher';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../../ports/session.repository';
import { InvalidResetTokenException } from '../../../exceptions/invalid-reset-token.exception';
import { ResetPasswordCommand } from './reset-password.command';

/**
 * The two orderings below are the security-relevant part; see
 * `VerifyEmailHandler` for the same total-switch dispatch on `ConsumeOutcome`.
 */
@CommandHandler(ResetPasswordCommand)
export class ResetPasswordHandler implements ICommandHandler<
  ResetPasswordCommand,
  void
> {
  constructor(
    @Inject(ONE_TIME_TOKEN_REPOSITORY)
    private readonly tokens: OneTimeTokenRepository,
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepository,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async execute(command: ResetPasswordCommand): Promise<void> {
    // Validated and hashed before the token is touched: a policy rejection
    // here must not cost the user their link. Nothing is written yet either
    // way.
    const newHash = await this.hasher.hash(
      Password.create(command.newPassword),
    );

    const now = new Date();
    const result = await this.tokens.consume(
      SecretToken.hashOf(command.token),
      TokenPurpose.passwordReset(),
      now,
    );

    switch (result.outcome) {
      case 'consumed': {
        // Consume-then-write, deliberately. If this write fails the token is
        // spent and the password unchanged, which costs another reset
        // request. The reverse order would leave a spent token still usable,
        // which is the failure that matters.
        const userId = UserId.create(result.userId);
        await this.credentials.changePassword(userId, newHash);

        // No exception: whoever prompted the reset may be holding a session.
        await this.sessions.revokeAllForUser(userId, now);
        return;
      }

      case 'expired':
        throw InvalidResetTokenException.expired();

      case 'used':
      case 'unknown':
        throw InvalidResetTokenException.invalid();

      /* istanbul ignore next -- unreachable by construction: this branch exists so
       * that adding a member to the union is a compile error, never a runtime path. */
      default: {
        const unhandled: never = result;
        throw new Error(
          `Unhandled consume outcome: ${JSON.stringify(unhandled)}`,
        );
      }
    }
  }
}
