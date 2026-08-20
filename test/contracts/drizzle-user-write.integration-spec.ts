import { eq, sql } from 'drizzle-orm';
import {
  DuplicateEmailException,
  type Registration,
} from '@/identity/application';
import { DrizzleUserWriteRepository } from '@/identity/infrastructure';
import {
  OneTimeTokenId,
  PasswordHash,
  SecretToken,
  User,
  UserProfile,
} from '@/identity/domain';
import {
  credentials,
  oneTimeTokens,
  users,
} from '@/shared/infrastructure/database/postgres/schema';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';

describe('DrizzleUserWriteRepository, beyond the shared contract', () => {
  const db = testDb();
  const repository = new DrizzleUserWriteRepository(db);

  const aRegistration = (user: User, tokenHash?: string): Registration => ({
    user,
    passwordHash: PasswordHash.create('hash-1'),
    verification: {
      id: OneTimeTokenId.create(),
      tokenHash: tokenHash
        ? SecretToken.hashOf(tokenHash)
        : SecretToken.issue().hash,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });

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
    await repository.register(aRegistration(user));

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
    // `register` always inserts under an id `User.create` minted itself, so
    // there is no way through the domain to hand it a colliding id. The id
    // collision is seeded directly, below the domain, purely to reach the
    // adapter's other branch: a 23505 that is not on users_email_unique.
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
    await expect(
      repository.register(aRegistration(collides)),
    ).rejects.not.toBeInstanceOf(DuplicateEmailException);
  });

  it('rolls back the user and credential rows when only the third insert fails', async () => {
    // Proves the three writes share one transaction rather than merely running
    // in sequence: the failure here is arranged to hit `one_time_tokens`, the
    // *last* statement, so a non-transactional `register` would already have
    // committed the user and credential rows by the time it throws. Seeding
    // a duplicate email, as the contract's own all-or-nothing case does,
    // cannot tell them apart, because that failure always hits the *first*
    // statement, before a non-atomic implementation would have written
    // anything either.
    const existing = User.create({
      firstName: 'Grace',
      lastName: 'Hopper',
      email: 'grace@example.com',
      role: 'customer',
    });
    const collidingToken = 'shared-plaintext-token';
    await repository.register(aRegistration(existing, collidingToken));

    const attempted = User.create({
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'seller',
    });

    await expect(
      repository.register(aRegistration(attempted, collidingToken)),
    ).rejects.not.toBeInstanceOf(DuplicateEmailException);

    // The users insert (first statement) and the credentials insert (second
    // statement) both succeeded before the token insert (third) collided; a
    // transaction is the only thing that can undo them once it has.
    await expect(repository.delete(attempted.id)).resolves.toBe(false);
    const creditRows = await db
      .select()
      .from(credentials)
      .where(eq(credentials.userId, attempted.id.value));
    expect(creditRows).toHaveLength(0);
    const tokenRows = await db
      .select()
      .from(oneTimeTokens)
      .where(eq(oneTimeTokens.userId, attempted.id.value));
    expect(tokenRows).toHaveLength(0);
  });
});
