import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';
import { SessionId, UserId } from '@/identity/domain';
import { SessionNotFoundException } from '../../../exceptions/session-not-found.exception';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../../ports/session.repository';
import { RevokeSessionCommand } from './revoke-session.command';

/**
 * The port returns false rather than throwing when no live session of this
 * user held that id; turning that into `SessionNotFoundException` happens
 * here.
 */
@CommandHandler(RevokeSessionCommand)
export class RevokeSessionHandler implements ICommandHandler<
  RevokeSessionCommand,
  void
> {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  async execute(command: RevokeSessionCommand): Promise<void> {
    const revoked = await this.sessions.revoke(
      SessionId.create(command.sessionId),
      UserId.create(command.userId),
      new Date(),
    );

    if (!revoked) {
      throw new SessionNotFoundException(command.sessionId);
    }
  }
}
