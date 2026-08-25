import type { ListedSession } from '@/identity/application';

/**
 * The wire contract for one device-list row, kept separate from
 * `ListedSession` on purpose: this class is the only compile-time checkpoint
 * marking what is public, so renaming a read-model field cannot change the
 * API silently. Dates travel as ISO strings.
 */
export class SessionResponseDto {
  id!: string;
  userAgent!: string | null;
  ipAddress!: string | null;
  createdAt!: string;
  lastSeenAt!: string;
  /** True on the row the request itself arrived on. */
  current!: boolean;

  static fromListed(item: ListedSession): SessionResponseDto {
    const dto = new SessionResponseDto();
    dto.id = item.id;
    dto.userAgent = item.userAgent;
    dto.ipAddress = item.ipAddress;
    dto.createdAt = item.createdAt.toISOString();
    dto.lastSeenAt = item.lastSeenAt.toISOString();
    dto.current = item.current;
    return dto;
  }
}
