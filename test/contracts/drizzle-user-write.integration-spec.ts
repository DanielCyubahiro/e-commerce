import { sql } from 'drizzle-orm';
import { DuplicateEmailException } from '@/identity/application';
import { DrizzleUserWriteRepository } from '@/identity/infrastructure';
import { User, UserProfile } from '@/identity/domain';
import { users } from '@/shared/infrastructure/database/postgres/schema';
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

  it('leaves updated_at to the trigger, which moves it on a profile replacement', async () => {
    const user = User.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'seller',
    });
    await repository.add(user);

    await repository.replaceProfile(
      user.id,
      UserProfile.create({
        firstName: 'Grace',
        lastName: 'Hopper',
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

  it('propagates a database error that is not a duplicate email', async () => {
    // `add` always inserts under an id `User.create` minted itself, so there is
    // no way through the domain to hand it a colliding id. The id collision is
    // seeded directly, below the domain, purely to reach the adapter's other
    // branch: a 23505 that is not on users_email_unique.
    const collides = User.create({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      role: 'customer',
    });
    await db.insert(users).values({
      id: collides.id.value,
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'seller',
    });

    // Same id, different email: the only 23505 an insert can raise that is
    // not on users_email_unique. If isDuplicateEmail matched on the code
    // alone, this primary-key collision on `id` would be misreported as a
    // duplicate email.
    await expect(repository.add(collides)).rejects.not.toBeInstanceOf(
      DuplicateEmailException,
    );
  });
});
