import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  Email,
  PasswordAttempt,
  SecretToken,
  SessionId,
  UserId,
} from '@/identity/domain';
import {
  CREDENTIAL_REPOSITORY,
  type CredentialRepository,
} from '../../../ports/credential.repository';
import {
  PASSWORD_HASHER,
  type PasswordHasher,
} from '../../../ports/password-hasher';
import {
  SESSION_REPOSITORY,
  type SessionOrigin,
  type SessionRepository,
} from '../../../ports/session.repository';
import { EmailNotVerifiedException } from '../../../exceptions/email-not-verified.exception';
import { InvalidCredentialsException } from '../../../exceptions/invalid-credentials.exception';
import { LoginCommand } from './login.command';

export interface LoginResult {
  /** The cookie's plaintext. Never stored; the row holds only its digest. */
  token: string;
  userId: string;
  role: string;
}

/**
 * The only place a session is started. Every failure before that answers with
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
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
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

    return this.startSession(record.userId, record.role, command.origin);
  }

  private async startSession(
    userId: string,
    role: string,
    origin: SessionOrigin,
  ): Promise<LoginResult> {
    const secret = SecretToken.issue();

    await this.sessions.start(
      {
        id: SessionId.create(),
        userId: UserId.create(userId),
        tokenHash: secret.hash,
        origin,
      },
      new Date(),
    );

    return { token: secret.plaintext, userId, role };
  }
}
