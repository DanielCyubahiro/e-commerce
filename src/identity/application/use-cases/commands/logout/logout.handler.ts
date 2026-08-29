import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SessionId, UserId } from '@/identity/domain';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../../ports/session.repository';
import { LogoutCommand } from './logout.command';

/**
 * Idempotent: the port's `false` for a session already dead is ignored, since
 * ending a session twice is not a failure a client can act on.
 */
@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand, void> {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  async execute(command: LogoutCommand): Promise<void> {
    await this.sessions.revoke(
      SessionId.create(command.sessionId),
      UserId.create(command.userId),
      new Date(),
    );
  }
}
