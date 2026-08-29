import { eq } from 'drizzle-orm';
import { DrizzleSessionRepository } from '@/identity/infrastructure';
import { SecretToken, SessionId, UserId } from '@/identity/domain';
import {
  sessions,
  users,
} from '@/shared/infrastructure/database/postgres/schema';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';
import { CONTRACT_LIFETIMES } from './session-repository.contract';

describe('DrizzleSessionRepository, beyond the shared contract', () => {
  const db = testDb();
  const repository = new DrizzleSessionRepository(db, CONTRACT_LIFETIMES);
  const now = new Date('2026-08-19T10:00:00.000Z');

  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('loses every session with its user row, so a deleted user is signed out at once', async () => {
    // The fake models no users table, so only the adapter can prove the
    // cascade. A live session outliving its user is the one orphan that would
    // still authenticate.
    const userId = UserId.create();
    await db.insert(users).values({
      id: userId.value,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'seller',
      phone: null,
    });
    const secret = SecretToken.issue();
    await repository.start(
      {
        id: SessionId.create(),
        userId,
        tokenHash: secret.hash,
        origin: { userAgent: null, ipAddress: null },
      },
      now,
    );

    await db.delete(users).where(eq(users.id, userId.value));

    await expect(repository.touch(secret.hash, now)).resolves.toBeNull();
    const remaining = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(eq(sessions.userId, userId.value));
    expect(remaining).toEqual([]);
  });
});
