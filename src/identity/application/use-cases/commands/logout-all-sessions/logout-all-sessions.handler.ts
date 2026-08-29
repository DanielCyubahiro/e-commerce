import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UserId } from '@/identity/domain';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../../ports/session.repository';
import { LogoutAllSessionsCommand } from './logout-all-sessions.command';

/**
 * No `exceptSessionId` is passed: unlike change-password, "log out
 * everywhere" means everywhere, including the session this request arrived
 * on.
 */
@CommandHandler(LogoutAllSessionsCommand)
export class LogoutAllSessionsHandler implements ICommandHandler<
  LogoutAllSessionsCommand,
  void
> {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  async execute(command: LogoutAllSessionsCommand): Promise<void> {
    await this.sessions.revokeAllForUser(
      UserId.create(command.userId),
      new Date(),
    );
  }
}
