import {
  DuplicateEmailException,
  type UserWriteRepository,
} from '@/identity/application';
import { User, UserId } from '@/identity/domain';
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
        role: 'seller',
        phone,
      });

    const replacementFor = (id: UserId, email: string): User =>
      User.replace(id, {
        firstName: 'Grace',
        lastName: 'Hopper',
        email,
        role: 'customer',
        phone: '+32489123456',
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

      await harness.repository.add(user);

      await expect(harness.repository.delete(user.id)).resolves.toBe(true);
    });

    it('stores a user with no phone', async () => {
      const user = aUser('nophone@example.com', null);

      await expect(harness.repository.add(user)).resolves.toBeUndefined();
      await expect(harness.repository.delete(user.id)).resolves.toBe(true);
    });

    it('rejects a second user holding the same email', async () => {
      await harness.repository.add(aUser());

      const error = await catchRejection(
        () => harness.repository.add(aUser()),
        DuplicateEmailException,
      );

      expect(error.code).toBe('USER_EMAIL_DUPLICATE');
    });

    it('treats a differently cased email as the same email', async () => {
      await harness.repository.add(aUser('ada@example.com'));

      // Email lowercases on construction, so the store never sees two cases.
      const error = await catchRejection(
        () => harness.repository.add(aUser('ADA@Example.com')),
        DuplicateEmailException,
      );

      expect(error.code).toBe('USER_EMAIL_DUPLICATE');
    });

    it('replaces every field under an id that exists', async () => {
      const user = aUser();
      await harness.repository.add(user);

      await expect(
        harness.repository.replace(
          replacementFor(user.id, 'grace@example.com'),
        ),
      ).resolves.toBe(true);
    });

    it('reports false rather than throwing when replacing an unknown id', async () => {
      const replacement = replacementFor(UserId.create(), 'nobody@example.com');

      await expect(harness.repository.replace(replacement)).resolves.toBe(
        false,
      );
    });

    it('lets a user keep its own email through a replace', async () => {
      const user = aUser();
      await harness.repository.add(user);

      await expect(
        harness.repository.replace(replacementFor(user.id, 'ada@example.com')),
      ).resolves.toBe(true);
    });

    it('rejects a replace onto an email another user holds', async () => {
      const first = aUser('ada@example.com');
      const second = aUser('grace@example.com');
      await harness.repository.add(first);
      await harness.repository.add(second);

      const error = await catchRejection(
        () =>
          harness.repository.replace(
            replacementFor(second.id, 'ada@example.com'),
          ),
        DuplicateEmailException,
      );

      expect(error.code).toBe('USER_EMAIL_DUPLICATE');
    });

    it('reports false rather than throwing when deleting an unknown id', async () => {
      await expect(harness.repository.delete(UserId.create())).resolves.toBe(
        false,
      );
    });

    it('reports false on a second delete of the same id', async () => {
      const user = aUser();
      await harness.repository.add(user);
      await harness.repository.delete(user.id);

      await expect(harness.repository.delete(user.id)).resolves.toBe(false);
    });

    it('an add rejected as a duplicate email leaves no row for it, and leaves the other user in place', async () => {
      const kept = aUser('keep@example.com');
      await harness.repository.add(kept);

      const rejected = aUser('keep@example.com');
      const error = await catchRejection(
        () => harness.repository.add(rejected),
        DuplicateEmailException,
      );
      expect(error.code).toBe('USER_EMAIL_DUPLICATE');

      // The row a partial write would land: proves nothing was inserted for
      // the rejected user, not just that the pre-existing one survived.
      await expect(harness.repository.delete(rejected.id)).resolves.toBe(false);
      await expect(harness.repository.delete(kept.id)).resolves.toBe(true);
    });

    it('a replace rejected as a duplicate email leaves the target user and its email intact', async () => {
      const kept = aUser('keep@example.com');
      const target = aUser('target@example.com');
      await harness.repository.add(kept);
      await harness.repository.add(target);

      const error = await catchRejection(
        () =>
          harness.repository.replace(
            replacementFor(target.id, 'keep@example.com'),
          ),
        DuplicateEmailException,
      );
      expect(error.code).toBe('USER_EMAIL_DUPLICATE');

      // This write-only harness has no read path, so the only way to show
      // target's email was not overwritten is that it is still taken.
      const stillTaken = await catchRejection(
        () => harness.repository.add(aUser('target@example.com')),
        DuplicateEmailException,
      );
      expect(stillTaken.code).toBe('USER_EMAIL_DUPLICATE');

      await expect(harness.repository.delete(target.id)).resolves.toBe(true);
    });
  });
}
