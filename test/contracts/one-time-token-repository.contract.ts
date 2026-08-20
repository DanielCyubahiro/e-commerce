import type { OneTimeTokenRepository } from '@/identity/application';
import {
  OneTimeTokenId,
  SecretToken,
  TokenPurpose,
  UserId,
} from '@/identity/domain';

export interface OneTimeTokenHarness {
  repository: OneTimeTokenRepository;
  /** Creates a user row the tokens can reference. Returns its id. */
  seedUser(email: string): Promise<string>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export function oneTimeTokenRepositoryContract(
  name: string,
  makeHarness: () => Promise<OneTimeTokenHarness>,
): void {
  describe(`OneTimeTokenRepository contract (${name})`, () => {
    let harness: OneTimeTokenHarness;
    let userId: string;

    const now = new Date('2026-08-19T10:00:00.000Z');
    const later = new Date('2026-08-19T11:00:00.000Z');
    const expiresAt = new Date('2026-08-19T10:30:00.000Z');

    const issue = async (
      secret: SecretToken,
      purpose = TokenPurpose.passwordReset(),
    ): Promise<void> =>
      harness.repository.issue({
        id: OneTimeTokenId.create(),
        purpose,
        userId: UserId.create(userId),
        tokenHash: secret.hash,
        expiresAt,
      });

    beforeAll(async () => {
      harness = await makeHarness();
    });

    beforeEach(async () => {
      await harness.reset();
      userId = await harness.seedUser('ada@example.com');
    });

    afterAll(async () => {
      await harness.close();
    });

    it('consumes a fresh token and reports whose it was', async () => {
      const secret = SecretToken.issue();
      await issue(secret);

      await expect(
        harness.repository.consume(
          secret.hash,
          TokenPurpose.passwordReset(),
          now,
        ),
      ).resolves.toEqual({ outcome: 'consumed', userId });
    });

    it('reports used on a second consume of the same token', async () => {
      const secret = SecretToken.issue();
      await issue(secret);
      await harness.repository.consume(
        secret.hash,
        TokenPurpose.passwordReset(),
        now,
      );

      await expect(
        harness.repository.consume(
          secret.hash,
          TokenPurpose.passwordReset(),
          now,
        ),
      ).resolves.toEqual({ outcome: 'used' });
    });

    it('reports expired for a token past its expiry', async () => {
      const secret = SecretToken.issue();
      await issue(secret);

      await expect(
        harness.repository.consume(
          secret.hash,
          TokenPurpose.passwordReset(),
          later,
        ),
      ).resolves.toEqual({ outcome: 'expired' });
    });

    it('reports unknown for a digest nobody issued', async () => {
      await expect(
        harness.repository.consume(
          SecretToken.issue().hash,
          TokenPurpose.passwordReset(),
          now,
        ),
      ).resolves.toEqual({ outcome: 'unknown' });
    });

    it('refuses a token presented for the wrong purpose', async () => {
      // The whole reason purpose is part of the lookup: a verification link
      // must not double as a password reset.
      const secret = SecretToken.issue();
      await issue(secret, TokenPurpose.emailVerification());

      await expect(
        harness.repository.consume(
          secret.hash,
          TokenPurpose.passwordReset(),
          now,
        ),
      ).resolves.toEqual({ outcome: 'unknown' });
    });

    it('leaves a token consumable after a wrong-purpose attempt', async () => {
      const secret = SecretToken.issue();
      await issue(secret, TokenPurpose.emailVerification());
      await harness.repository.consume(
        secret.hash,
        TokenPurpose.passwordReset(),
        now,
      );

      await expect(
        harness.repository.consume(
          secret.hash,
          TokenPurpose.emailVerification(),
          now,
        ),
      ).resolves.toEqual({ outcome: 'consumed', userId });
    });

    it('invalidates a prior unused token of the same purpose when a new one is issued', async () => {
      // Otherwise the link in an older email keeps working, so "resend" widens
      // the window instead of replacing it.
      const first = SecretToken.issue();
      const second = SecretToken.issue();
      await issue(first);
      await issue(second);

      await expect(
        harness.repository.consume(
          first.hash,
          TokenPurpose.passwordReset(),
          now,
        ),
      ).resolves.toEqual({ outcome: 'unknown' });
      await expect(
        harness.repository.consume(
          second.hash,
          TokenPurpose.passwordReset(),
          now,
        ),
      ).resolves.toEqual({ outcome: 'consumed', userId });
    });

    it('leaves the other purpose alone when one is reissued', async () => {
      const verification = SecretToken.issue();
      await issue(verification, TokenPurpose.emailVerification());
      await issue(SecretToken.issue(), TokenPurpose.passwordReset());

      await expect(
        harness.repository.consume(
          verification.hash,
          TokenPurpose.emailVerification(),
          now,
        ),
      ).resolves.toEqual({ outcome: 'consumed', userId });
    });

    it('keeps a used token, because it is what makes a replay reportable', async () => {
      const first = SecretToken.issue();
      await issue(first);
      await harness.repository.consume(
        first.hash,
        TokenPurpose.passwordReset(),
        now,
      );
      await issue(SecretToken.issue());

      // Issue deletes prior *unused* tokens only. A consumed one still answers
      // `used` rather than `unknown`, which is a different message to the user.
      await expect(
        harness.repository.consume(
          first.hash,
          TokenPurpose.passwordReset(),
          now,
        ),
      ).resolves.toEqual({ outcome: 'used' });
    });
  });
}
