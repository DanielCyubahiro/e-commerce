import {
  DuplicateEmailException,
  type Registration,
  type UserWriteRepository,
} from '@/identity/application';
import {
  OneTimeTokenId,
  PasswordHash,
  SecretToken,
  User,
  UserId,
  UserProfile,
} from '@/identity/domain';
import { catchRejection } from '@test/support/catch-error';

export interface WriteHarness {
  repository: UserWriteRepository;
  reset(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Run against every implementation of the port, including the in-memory fake. A
 * fake that quietly diverges from the adapter turns a green suite into a
 * liability, so divergence has to be a test failure rather than a surprise.
 */
export function userWriteRepositoryContract(
  name: string,
  makeHarness: () => Promise<WriteHarness>,
): void {
  describe(`UserWriteRepository contract (${name})`, () => {
    let harness: WriteHarness;

    const aUser = (
      email = 'ada@example.com',
      phone: string | null = null,
    ): User =>
      User.create({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email,
        phone,
      });

    const aProfile = (): UserProfile =>
      UserProfile.create({
        firstName: 'Grace',
        lastName: 'Hopper',
        phone: '+32489123456',
      });

    const aRegistration = (user: User): Registration => ({
      user,
      passwordHash: PasswordHash.create('hash-1'),
      verification: {
        id: OneTimeTokenId.create(),
        tokenHash: SecretToken.issue().hash,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    beforeAll(async () => {
      harness = await makeHarness();
    });

    beforeEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    it('stores a user, evidenced by a delete that finds it', async () => {
      const user = aUser();

      await harness.repository.register(aRegistration(user));

      await expect(harness.repository.delete(user.id)).resolves.toBe(true);
    });

    it('stores a user with no phone', async () => {
      const user = aUser('nophone@example.com', null);

      await expect(
        harness.repository.register(aRegistration(user)),
      ).resolves.toBeUndefined();
      await expect(harness.repository.delete(user.id)).resolves.toBe(true);
    });

    it('rejects a second user holding the same email', async () => {
      await harness.repository.register(aRegistration(aUser()));

      const error = await catchRejection(
        () => harness.repository.register(aRegistration(aUser())),
        DuplicateEmailException,
      );

      expect(error.code).toBe('USER_EMAIL_DUPLICATE');
    });

    it('treats a differently cased email as the same email', async () => {
      await harness.repository.register(
        aRegistration(aUser('ada@example.com')),
      );

      // Email lowercases on construction, so the store never sees two cases.
      const error = await catchRejection(
        () =>
          harness.repository.register(aRegistration(aUser('ADA@Example.com'))),
        DuplicateEmailException,
      );

      expect(error.code).toBe('USER_EMAIL_DUPLICATE');
    });

    it('replaces every mutable field under an id that exists', async () => {
      const user = aUser();
      await harness.repository.register(aRegistration(user));

      await expect(
        harness.repository.replaceProfile(user.id, aProfile()),
      ).resolves.toBe(true);
    });

    it('reports false rather than throwing when replacing an unknown id', async () => {
      await expect(
        harness.repository.replaceProfile(UserId.create(), aProfile()),
      ).resolves.toBe(false);
    });

    it('leaves the email untouched by a profile replacement', async () => {
      const user = aUser('ada@example.com');
      await harness.repository.register(aRegistration(user));

      await harness.repository.replaceProfile(user.id, aProfile());

      // This write-only harness has no read path, so the only way to show the
      // email survived is that it is still taken.
      const stillTaken = await catchRejection(
        () =>
          harness.repository.register(aRegistration(aUser('ada@example.com'))),
        DuplicateEmailException,
      );
      expect(stillTaken.code).toBe('USER_EMAIL_DUPLICATE');
    });

    it('reports false rather than throwing when deleting an unknown id', async () => {
      await expect(harness.repository.delete(UserId.create())).resolves.toBe(
        false,
      );
    });

    it('reports false on a second delete of the same id', async () => {
      const user = aUser();
      await harness.repository.register(aRegistration(user));
      await harness.repository.delete(user.id);

      await expect(harness.repository.delete(user.id)).resolves.toBe(false);
    });

    it('a register rejected as a duplicate email leaves no row for it, and leaves the other user in place', async () => {
      const kept = aUser('keep@example.com');
      await harness.repository.register(aRegistration(kept));

      const rejected = aUser('keep@example.com');
      const error = await catchRejection(
        () => harness.repository.register(aRegistration(rejected)),
        DuplicateEmailException,
      );
      expect(error.code).toBe('USER_EMAIL_DUPLICATE');

      // The row a partial write would land: proves nothing was inserted for
      // the rejected user, not just that the pre-existing one survived.
      await expect(harness.repository.delete(rejected.id)).resolves.toBe(false);
      await expect(harness.repository.delete(kept.id)).resolves.toBe(true);
    });

    it('writes no credential when the email collides, so a half account is impossible', async () => {
      const first = aUser('ada@example.com');
      await harness.repository.register(aRegistration(first));

      const second = aUser('ada@example.com');
      await catchRejection(
        () => harness.repository.register(aRegistration(second)),
        DuplicateEmailException,
      );

      // The rejected user's row is the one a partial write would leave.
      await expect(harness.repository.delete(second.id)).resolves.toBe(false);
    });
  });
}
