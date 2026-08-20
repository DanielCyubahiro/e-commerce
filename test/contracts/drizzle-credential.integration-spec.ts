import { randomUUID } from 'node:crypto';
import { DrizzleCredentialRepository } from '@/identity/infrastructure';
import { Email } from '@/identity/domain';
import { users } from '@/shared/infrastructure/database/postgres/schema';
import { closeTestDb, testDb, truncateAll } from '@test/setup/test-db';

// Outside the shared contract, the same way jose-access-token.integration-spec
// covers expiry: the harness's seed always writes both a users row and a
// credentials row, and the in-memory fake holds only the joined shape, so
// neither binding can represent a user with no credential row. That gap is
// exactly what the inner join in drizzle-credential.repository.ts exists to
// answer, and holding the fake to it would only make the fake lie more
// elaborately.
describe('DrizzleCredentialRepository, a user with no credential row', () => {
  const db = testDb();
  const repository = new DrizzleCredentialRepository(db);

  beforeEach(async () => {
    await truncateAll(db);
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it('answers findAuthentication like an unknown email, not a join failure', async () => {
    // Inserted directly: pre-migration data or a botched registration are the
    // only ways this row shape occurs, and the domain offers no path to create
    // a user without a credential.
    await db.insert(users).values({
      id: randomUUID(),
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      role: 'seller',
      phone: null,
    });

    await expect(
      repository.findAuthentication(Email.create('ada@example.com')),
    ).resolves.toBeNull();
  });
});
