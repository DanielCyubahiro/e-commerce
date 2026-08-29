import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SecretToken } from '@/identity/domain';
import {
  type AuthenticatedSession,
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../../ports/session.repository';
import { AuthenticateSessionCommand } from './authenticate-session.command';

/**
 * Runs on every protected request. Answers null rather than throwing, because
 * the guard owns the decision to answer 401, and it is the only caller.
 */
@CommandHandler(AuthenticateSessionCommand)
export class AuthenticateSessionHandler implements ICommandHandler<
  AuthenticateSessionCommand,
  AuthenticatedSession | null
> {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  execute(
    command: AuthenticateSessionCommand,
  ): Promise<AuthenticatedSession | null> {
    return this.sessions.touch(
      SecretToken.hashOf(command.presentedToken),
      new Date(),
    );
  }
}
