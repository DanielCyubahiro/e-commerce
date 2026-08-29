import { Inject } from '@nestjs/common';
import { type IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UserId } from '@/identity/domain';
import {
  SESSION_REPOSITORY,
  type SessionRepository,
} from '../../../ports/session.repository';
import type { SessionReadModel } from '../../../read-models/session.read-model';
import { ListSessionsQuery } from './list-sessions.query';

/** A read model plus the one fact that is relative to the caller. */
export interface ListedSession extends SessionReadModel {
  current: boolean;
}

@QueryHandler(ListSessionsQuery)
export class ListSessionsHandler implements IQueryHandler<
  ListSessionsQuery,
  ListedSession[]
> {
  constructor(
    @Inject(SESSION_REPOSITORY) private readonly sessions: SessionRepository,
  ) {}

  async execute(query: ListSessionsQuery): Promise<ListedSession[]> {
    const rows = await this.sessions.listLiveForUser(
      UserId.create(query.userId),
      new Date(),
    );

    return rows.map((row) => ({
      ...row,
      current: row.id === query.currentSessionId,
    }));
  }
}
