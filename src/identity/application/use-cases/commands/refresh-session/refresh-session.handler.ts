import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { RefreshTokenId, SecretToken, SessionId } from '@/identity/domain';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from '../../../ports/access-token.issuer';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../../ports/refresh-token.repository';
import {
  TOKEN_LIFETIMES,
  type TokenLifetimes,
  refreshExpiry,
} from '../../../token-lifetimes';
import { InvalidRefreshTokenException } from '../../../exceptions/invalid-refresh-token.exception';
import type { LoginResult } from '../login/login.handler';
import { RefreshSessionCommand } from './refresh-session.command';

/**
 * The first, and only, consumer of `RotationOutcome`. Every branch below is
 * where the reuse-detection contract either pays off or gets discarded; see
 * `RefreshTokenRepository.rotate` for what each outcome means.
 */
@CommandHandler(RefreshSessionCommand)
export class RefreshSessionHandler implements ICommandHandler<
  RefreshSessionCommand,
  LoginResult
> {
  constructor(
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepository,
    @Inject(ACCESS_TOKEN_ISSUER)
    private readonly accessTokens: AccessTokenIssuer,
    @Inject(TOKEN_LIFETIMES) private readonly lifetimes: TokenLifetimes,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<LoginResult> {
    const now = new Date();
    const successor = SecretToken.issue();

    const result = await this.refreshTokens.rotate(
      SecretToken.hashOf(command.refreshToken),
      {
        id: RefreshTokenId.create(),
        tokenHash: successor.hash,
        expiresAt: refreshExpiry(now, this.lifetimes),
      },
      now,
    );

    switch (result.outcome) {
      case 'rotated': {
        const access = await this.accessTokens.issue({
          userId: result.userId,
          role: result.role,
          // The chain survives rotation, so logout still recognises the session.
          sessionId: result.sessionId,
        });

        return {
          accessToken: access.token,
          expiresInSeconds: access.expiresInSeconds,
          refreshToken: successor.plaintext,
        };
      }

      case 'replayed':
        // Two parties held one token, so exactly one of them is an attacker
        // and there is no way to tell which. Killing the whole chain costs
        // the legitimate user one sign-in and costs the attacker the account.
        await this.refreshTokens.revokeSession(
          SessionId.create(result.sessionId),
          now,
        );
        throw new InvalidRefreshTokenException();

      case 'expired':
      case 'revoked':
      case 'unknown':
        // `revoked` is classified ahead of `replayed` by the adapter, so a
        // chain an earlier detection already killed lands here rather than
        // calling revokeSession again on every later attempt.
        throw new InvalidRefreshTokenException();

      /* istanbul ignore next -- unreachable by construction: this branch exists so
       * that adding a member to the union is a compile error, never a runtime path. */
      default: {
        const unhandled: never = result;
        throw new Error(
          `Unhandled rotation outcome: ${JSON.stringify(unhandled)}`,
        );
      }
    }
  }
}
