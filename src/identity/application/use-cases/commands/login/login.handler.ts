import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  Email,
  PasswordAttempt,
  RefreshTokenId,
  SecretToken,
  SessionId,
  UserId,
} from '@/identity/domain';
import {
  ACCESS_TOKEN_ISSUER,
  type AccessTokenIssuer,
} from '../../../ports/access-token.issuer';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepository,
} from '../../../ports/credential.repository';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../../ports/password-hasher';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../../ports/refresh-token.repository';
import {
  TOKEN_LIFETIMES,
  type TokenLifetimes,
  refreshExpiry,
} from '../../../token-lifetimes';
import { EmailNotVerifiedException } from '../../../exceptions/email-not-verified.exception';
import { InvalidCredentialsException } from '../../../exceptions/invalid-credentials.exception';
import { LoginCommand } from './login.command';

export interface LoginResult {
  accessToken: string;
  expiresInSeconds: number;
  refreshToken: string;
}

/**
 * The only place tokens are minted. Every failure before the mint answers with
 * one code, and the two orderings below are the security-relevant part.
 */
@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<
  LoginCommand,
  LoginResult
> {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepository,
    @Inject(ACCESS_TOKEN_ISSUER)
    private readonly accessTokens: AccessTokenIssuer,
    @Inject(TOKEN_LIFETIMES) private readonly lifetimes: TokenLifetimes,
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const attempt = PasswordAttempt.create(command.password);
    const record = await this.credentials.findAuthentication(
      Email.create(command.email),
    );

    // A verification is spent even when nothing matched, against a hash that
    // cannot succeed, so an address with no account costs the same as a wrong
    // password. Skip it and response timing reveals which addresses exist,
    // however identical the bodies are.
    const matches = await this.hasher.verify(
      attempt,
      record?.passwordHash ?? this.hasher.dummyHash(),
    );

    if (!record || !matches) {
      throw new InvalidCredentialsException();
    }

    // After the password check, never before: reporting this to someone who
    // does not know the password would confirm the account exists.
    if (record.emailVerifiedAt === null) {
      throw new EmailNotVerifiedException();
    }

    return this.startSession(record.userId, record.role);
  }

  private async startSession(
    userId: string,
    role: string,
  ): Promise<LoginResult> {
    const sessionId = SessionId.create();
    const refresh = SecretToken.issue();

    await this.refreshTokens.issue({
      id: RefreshTokenId.create(),
      sessionId,
      userId: UserId.create(userId),
      tokenHash: refresh.hash,
      expiresAt: refreshExpiry(new Date(), this.lifetimes),
    });

    const access = await this.accessTokens.issue({
      userId,
      role,
      sessionId: sessionId.value,
    });

    return {
      accessToken: access.token,
      expiresInSeconds: access.expiresInSeconds,
      refreshToken: refresh.plaintext,
    };
  }
}
