import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import {
  Password,
  PasswordAttempt,
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
  type SessionRepository,
} from '../../../ports/session.repository';
import { InvalidCredentialsException } from '../../../exceptions/invalid-credentials.exception';
import { ChangePasswordCommand } from './change-password.command';

/**
 * The current-password check and the session-sparing revocation below are the
 * security-relevant parts; see the class comment on the port for why reset,
 * the other write path to this same column, revokes differently.
 */
@CommandHandler(ChangePasswordCommand)
export class ChangePasswordHandler implements ICommandHandler<
  ChangePasswordCommand,
  void
> {
  constructor(
    @Inject(CREDENTIAL_REPOSITORY)
    private readonly credentials: CredentialRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    const userId = UserId.create(command.userId);
    const attempt = PasswordAttempt.create(command.currentPassword);

    // Validated before the current password is checked, so a policy failure
    // does not depend on getting the old password right. Only *validated*
    // here, not hashed: `Password.create` is a length check costing nothing,
    // while hashing spends 19 MiB of argon2, and a hash computed before the
    // check below is discarded with certainty on the failure path.
    const password = Password.create(command.newPassword);

    const stored = await this.credentials.findPasswordHash(userId);

    // A live session proves the caller holds a cookie, not that they are the
    // account owner. Requiring the current password is what stops a stolen
    // cookie turning into permanent account takeover for as long as the
    // session lives.
    const matches =
      stored !== null && (await this.hasher.verify(attempt, stored));

    if (!matches) {
      throw new InvalidCredentialsException();
    }

    // Hashed only now that the caller has proven they know the current
    // password.
    const newHash = await this.hasher.hash(password);

    const now = new Date();
    await this.credentials.changePassword(userId, newHash);

    // Every other session goes; this one stays, which is what a user expects
    // from changing their own password rather than recovering it.
    await this.sessions.revokeAllForUser(
      userId,
      now,
      SessionId.create(command.sessionId),
    );
  }
}
