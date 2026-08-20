import type { PasswordHasher } from '@/identity/application';
import { Password, PasswordAttempt, PasswordHash } from '@/identity/domain';

export interface HasherHarness {
  hasher: PasswordHasher;
}

/**
 * Run against every implementation, including the fake. The fake is what every
 * handler spec and http-spec uses, because argon2 at 19 MiB is deliberately
 * slow; this suite is what stops it drifting from the real thing.
 */
export function passwordHasherContract(
  name: string,
  makeHarness: () => Promise<HasherHarness>,
): void {
  describe(`PasswordHasher contract (${name})`, () => {
    let harness: HasherHarness;

    const password = Password.create('correct horse battery');
    const attempt = (raw: string): PasswordAttempt =>
      PasswordAttempt.create(raw);

    beforeAll(async () => {
      harness = await makeHarness();
    });

    it('verifies a password against its own hash', async () => {
      const hash = await harness.hasher.hash(password);

      await expect(
        harness.hasher.verify(attempt('correct horse battery'), hash),
      ).resolves.toBe(true);
    });

    it('rejects a different password', async () => {
      const hash = await harness.hasher.hash(password);

      await expect(
        harness.hasher.verify(attempt('wrong horse battery'), hash),
      ).resolves.toBe(false);
    });

    it('rejects an empty attempt', async () => {
      const hash = await harness.hasher.hash(password);

      await expect(harness.hasher.verify(attempt(''), hash)).resolves.toBe(
        false,
      );
    });

    it('salts, so the same password hashes differently each time', async () => {
      const first = await harness.hasher.hash(password);
      const second = await harness.hasher.hash(password);

      expect(first.value).not.toBe(second.value);
      await expect(
        harness.hasher.verify(attempt('correct horse battery'), second),
      ).resolves.toBe(true);
    });

    it('returns false rather than throwing for a hash it cannot parse', async () => {
      await expect(
        harness.hasher.verify(
          attempt('correct horse battery'),
          PasswordHash.create('not-a-hash-this-implementation-made'),
        ),
      ).resolves.toBe(false);
    });

    it('offers a dummy hash that nothing matches', async () => {
      const dummy = harness.hasher.dummyHash();

      await expect(
        harness.hasher.verify(attempt('correct horse battery'), dummy),
      ).resolves.toBe(false);
      await expect(harness.hasher.verify(attempt(''), dummy)).resolves.toBe(
        false,
      );
    });

    it('returns the same dummy hash every call, so it can be a constant', () => {
      expect(harness.hasher.dummyHash().value).toBe(
        harness.hasher.dummyHash().value,
      );
    });
  });
}
