import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { UserId } from '@/identity/domain';
import {
  REFRESH_TOKEN_REPOSITORY,
  type RefreshTokenRepository,
} from '../../../ports/refresh-token.repository';
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
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokens: RefreshTokenRepository,
  ) {}

  async execute(command: LogoutAllSessionsCommand): Promise<void> {
    await this.refreshTokens.revokeAllForUser(
      UserId.create(command.userId),
      new Date(),
    );
  }
}
