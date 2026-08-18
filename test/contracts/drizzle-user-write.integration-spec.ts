import { sql } from 'drizzle-orm';
import { DrizzleUserWriteRepository } from '@/user/infrastructure';
import { User, UserId } from '@/user/domain';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';

describe('DrizzleUserWriteRepository, beyond the shared contract', () => {
  const db = testDb();
  const repository = new DrizzleUserWriteRepository(db);

  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('leaves updated_at to the trigger, which moves it on replace', async () => {
    const user = User.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'seller',
    });
    await repository.add(user);

    await repository.replace(
      User.replace(UserId.create(user.id.value), {
        firstName: 'Grace',
        lastName: 'Hopper',
        email: 'grace@example.com',
        role: 'customer',
      }),
    );

    const rows = await db.execute<{ moved: boolean }>(sql`
      SELECT updated_at > created_at AS moved FROM users WHERE id = ${user.id.value}
    `);

    // The adapter never sets updated_at; a fork that drops the trigger leaves
    // it frozen here with no error anywhere. See ADR 0009.
    expect(rows[0]?.moved).toBe(true);
  });
});
