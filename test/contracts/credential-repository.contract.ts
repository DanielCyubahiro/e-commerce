import type { CredentialRepository } from '@/identity/application';
import { Email, PasswordHash, UserId } from '@/identity/domain';

export interface CredentialHarness {
  repository: CredentialRepository;
  /** Creates a user and its credential. Returns the user's id. */
  seed(input: {
    email: string;
    role: string;
    passwordHash: string;
    emailVerifiedAt?: Date | null;
  }): Promise<string>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export function credentialRepositoryContract(
  name: string,
  makeHarness: () => Promise<CredentialHarness>,
): void {
  describe(`CredentialRepository contract (${name})`, () => {
    let harness: CredentialHarness;

    const seeded = (
      over: Partial<Parameters<CredentialHarness['seed']>[0]> = {},
    ) =>
      harness.seed({
        email: 'ada@example.com',
        role: 'seller',
        passwordHash: 'hash-1',
        ...over,
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

    it('finds the authentication record for a known email', async () => {
      const id = await seeded();

      const record = await harness.repository.findAuthentication(
        Email.create('ada@example.com'),
      );

      expect(record).toEqual({
        userId: id,
        role: 'seller',
        passwordHash: PasswordHash.create('hash-1'),
        emailVerifiedAt: null,
      });
    });

    it('matches an email case-insensitively, because Email lowercases', async () => {
      await seeded();

      await expect(
        harness.repository.findAuthentication(Email.create('ADA@Example.com')),
      ).resolves.not.toBeNull();
    });

    it('returns null for an email nobody holds', async () => {
      await expect(
        harness.repository.findAuthentication(
          Email.create('nobody@example.com'),
        ),
      ).resolves.toBeNull();
    });

    it('reports the verification timestamp when there is one', async () => {
      const verifiedAt = new Date('2026-01-02T03:04:05.000Z');
      await seeded({ emailVerifiedAt: verifiedAt });

      const record = await harness.repository.findAuthentication(
        Email.create('ada@example.com'),
      );

      expect(record?.emailVerifiedAt).toEqual(verifiedAt);
    });

    it('finds a password hash by user id', async () => {
      const id = await seeded();

      await expect(
        harness.repository.findPasswordHash(UserId.create(id)),
      ).resolves.toEqual(PasswordHash.create('hash-1'));
    });

    it('returns null for a user id with no credential', async () => {
      await expect(
        harness.repository.findPasswordHash(UserId.create()),
      ).resolves.toBeNull();
    });

    it('marks an unverified email verified', async () => {
      const id = await seeded();
      const now = new Date('2026-03-04T05:06:07.000Z');

      await expect(
        harness.repository.markEmailVerified(UserId.create(id), now),
      ).resolves.toBe(true);

      const record = await harness.repository.findAuthentication(
        Email.create('ada@example.com'),
      );
      expect(record?.emailVerifiedAt).toEqual(now);
    });

    it('reports false on a second verification, and keeps the first timestamp', async () => {
      const id = await seeded();
      const first = new Date('2026-03-04T05:06:07.000Z');
      const second = new Date('2026-03-05T05:06:07.000Z');
      await harness.repository.markEmailVerified(UserId.create(id), first);

      // Guarded on email_verified_at IS NULL: a replayed verification link is a
      // no-op rather than a way to move the timestamp forward.
      await expect(
        harness.repository.markEmailVerified(UserId.create(id), second),
      ).resolves.toBe(false);

      const record = await harness.repository.findAuthentication(
        Email.create('ada@example.com'),
      );
      expect(record?.emailVerifiedAt).toEqual(first);
    });

    it('reports false when verifying a user id with no credential', async () => {
      await expect(
        harness.repository.markEmailVerified(UserId.create(), new Date()),
      ).resolves.toBe(false);
    });

    it('changes a password hash', async () => {
      const id = await seeded();

      await expect(
        harness.repository.changePassword(
          UserId.create(id),
          PasswordHash.create('hash-2'),
        ),
      ).resolves.toBe(true);

      await expect(
        harness.repository.findPasswordHash(UserId.create(id)),
      ).resolves.toEqual(PasswordHash.create('hash-2'));
    });

    it('leaves the verification timestamp alone when the password changes', async () => {
      const verifiedAt = new Date('2026-01-02T03:04:05.000Z');
      const id = await seeded({ emailVerifiedAt: verifiedAt });

      await harness.repository.changePassword(
        UserId.create(id),
        PasswordHash.create('hash-2'),
      );

      const record = await harness.repository.findAuthentication(
        Email.create('ada@example.com'),
      );
      expect(record?.emailVerifiedAt).toEqual(verifiedAt);
    });

    it('reports false when changing the password of a user with no credential', async () => {
      await expect(
        harness.repository.changePassword(
          UserId.create(),
          PasswordHash.create('hash-2'),
        ),
      ).resolves.toBe(false);
    });
  });
}
