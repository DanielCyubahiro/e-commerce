import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SecretToken, TokenPurpose, UserId } from '@/identity/domain';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepository,
} from '../../../ports/credential.repository';
import {
  ONE_TIME_TOKEN_REPOSITORY,
  type OneTimeTokenRepository,
} from '../../../ports/one-time-token.repository';
import { InvalidVerificationTokenException } from '../../../exceptions/invalid-verification-token.exception';
import { VerifyEmailCommand } from './verify-email.command';

@CommandHandler(VerifyEmailCommand)
export class VerifyEmailHandler implements ICommandHandler<
  VerifyEmailCommand,
  void
> {
  constructor(
    @Inject(ONE_TIME_TOKEN_REPOSITORY)
    private readonly tokens: OneTimeTokenRepository,
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepository,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<void> {
    const now = new Date();
    const result = await this.tokens.consume(
      SecretToken.hashOf(command.token),
      TokenPurpose.emailVerification(),
      now,
    );

    switch (result.outcome) {
      case 'consumed':
        // `result.userId` is typed string here, narrowed by the switch rather
        // than asserted. The boolean is ignored deliberately: the token was
        // single-use and is now spent, so the only way this returns false is a
        // credential already verified, which is the state the caller wanted
        // either way.
        await this.credentials.markEmailVerified(
          UserId.create(result.userId),
          now,
        );
        return;

      case 'used':
        // A replayed link. The token being spent means verification already
        // happened, so an error would contradict the stored state. A
        // double-clicked link and a mail scanner that follows links both land
        // here.
        return;

      case 'expired':
        throw InvalidVerificationTokenException.expired();

      case 'unknown':
        throw InvalidVerificationTokenException.invalid();

      default: {
        const unhandled: never = result;
        throw new Error(
          `Unhandled consume outcome: ${JSON.stringify(unhandled)}`,
        );
      }
    }
  }
}
