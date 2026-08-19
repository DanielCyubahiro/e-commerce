import type {
  RefreshSuccessor,
  RefreshTokenRepository,
} from '@/identity/application';
import {
  RefreshTokenId,
  SecretToken,
  SessionId,
  UserId,
} from '@/identity/domain';

export interface RefreshTokenHarness {
  repository: RefreshTokenRepository;
  /** Creates a user row the tokens can reference. Returns its id. */
  seedUser(email: string, role: string): Promise<string>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export function refreshTokenRepositoryContract(
  name: string,
  makeHarness: () => Promise<RefreshTokenHarness>,
): void {
  describe(`RefreshTokenRepository contract (${name})`, () => {
    let harness: RefreshTokenHarness;
    let userId: string;

    const now = new Date('2026-08-19T10:00:00.000Z');
    const future = new Date('2026-09-18T10:00:00.000Z');
    const past = new Date('2026-08-18T10:00:00.000Z');

    const successor = (): RefreshSuccessor => ({
      id: RefreshTokenId.create(),
      tokenHash: SecretToken.issue().hash,
      expiresAt: future,
    });

    const issue = (
      secret: SecretToken,
      sessionId: SessionId,
      expiresAt = future,
    ): Promise<void> =>
      harness.repository.issue({
        id: RefreshTokenId.create(),
        sessionId,
        userId: UserId.create(userId),
        tokenHash: secret.hash,
        expiresAt,
      });

    beforeAll(async () => {
      harness = await makeHarness();
    });

    beforeEach(async () => {
      await harness.reset();
      userId = await harness.seedUser('ada@example.com', 'seller');
    });

    afterAll(async () => {
      await harness.close();
    });

    it('rotates a fresh token and reports the claims for the next access token', async () => {
      const secret = SecretToken.issue();
      const sessionId = SessionId.create();
      await issue(secret, sessionId);

      await expect(
        harness.repository.rotate(secret.hash, successor(), now),
      ).resolves.toEqual({
        outcome: 'rotated',
        userId,
        role: 'seller',
        sessionId: sessionId.value,
      });
    });

    it('leaves the successor usable and the predecessor not', async () => {
      const secret = SecretToken.issue();
      const next = SecretToken.issue();
      await issue(secret, SessionId.create());
      await harness.repository.rotate(
        secret.hash,
        {
          id: RefreshTokenId.create(),
          tokenHash: next.hash,
          expiresAt: future,
        },
        now,
      );

      await expect(
        harness.repository.rotate(next.hash, successor(), now),
      ).resolves.toMatchObject({ outcome: 'rotated' });
    });

    it('keeps the successor in the same chain, so revoking it kills both', async () => {
      const secret = SecretToken.issue();
      const next = SecretToken.issue();
      const sessionId = SessionId.create();
      await issue(secret, sessionId);
      await harness.repository.rotate(
        secret.hash,
        {
          id: RefreshTokenId.create(),
          tokenHash: next.hash,
          expiresAt: future,
        },
        now,
      );

      await harness.repository.revokeSession(sessionId, now);

      await expect(
        harness.repository.rotate(next.hash, successor(), now),
      ).resolves.toEqual({ outcome: 'revoked' });
    });

    it('reports a replay, with the chain to revoke', async () => {
      const secret = SecretToken.issue();
      const sessionId = SessionId.create();
      await issue(secret, sessionId);
      await harness.repository.rotate(secret.hash, successor(), now);

      // The signal reuse detection exists for: two parties hold one token.
      await expect(
        harness.repository.rotate(secret.hash, successor(), now),
      ).resolves.toEqual({ outcome: 'replayed', sessionId: sessionId.value });
    });

    it('mints no successor when the presented token is a replay', async () => {
      const secret = SecretToken.issue();
      await issue(secret, SessionId.create());
      await harness.repository.rotate(secret.hash, successor(), now);
      const third = successor();
      await harness.repository.rotate(secret.hash, third, now);

      await expect(
        harness.repository.rotate(third.tokenHash, successor(), now),
      ).resolves.toEqual({ outcome: 'unknown' });
    });

    it('reports expired past the expiry, without minting a successor', async () => {
      const secret = SecretToken.issue();
      await issue(secret, SessionId.create(), past);

      await expect(
        harness.repository.rotate(secret.hash, successor(), now),
      ).resolves.toEqual({ outcome: 'expired' });
    });

    it('reports unknown for a digest nobody issued', async () => {
      await expect(
        harness.repository.rotate(SecretToken.issue().hash, successor(), now),
      ).resolves.toEqual({ outcome: 'unknown' });
    });

    it('reports revoked ahead of replayed for a token that is both', async () => {
      // A revoked chain answers `revoked` even for a token that was also used,
      // so the handler does not re-revoke a chain that is already dead.
      const secret = SecretToken.issue();
      const sessionId = SessionId.create();
      await issue(secret, sessionId);
      await harness.repository.rotate(secret.hash, successor(), now);
      await harness.repository.revokeSession(sessionId, now);

      await expect(
        harness.repository.rotate(secret.hash, successor(), now),
      ).resolves.toEqual({ outcome: 'revoked' });
    });

    it('revokes every chain a user has', async () => {
      const first = SecretToken.issue();
      const second = SecretToken.issue();
      await issue(first, SessionId.create());
      await issue(second, SessionId.create());

      await harness.repository.revokeAllForUser(UserId.create(userId), now);

      await expect(
        harness.repository.rotate(first.hash, successor(), now),
      ).resolves.toEqual({ outcome: 'revoked' });
      await expect(
        harness.repository.rotate(second.hash, successor(), now),
      ).resolves.toEqual({ outcome: 'revoked' });
    });

    it('spares one chain when asked, so a password change keeps the caller signed in', async () => {
      const kept = SecretToken.issue();
      const dropped = SecretToken.issue();
      const keptSession = SessionId.create();
      await issue(kept, keptSession);
      await issue(dropped, SessionId.create());

      await harness.repository.revokeAllForUser(
        UserId.create(userId),
        now,
        keptSession,
      );

      await expect(
        harness.repository.rotate(kept.hash, successor(), now),
      ).resolves.toMatchObject({ outcome: 'rotated' });
      await expect(
        harness.repository.rotate(dropped.hash, successor(), now),
      ).resolves.toEqual({ outcome: 'revoked' });
    });

    it('leaves another user’s chains alone', async () => {
      const mine = SecretToken.issue();
      await issue(mine, SessionId.create());
      const otherId = await harness.seedUser('grace@example.com', 'customer');
      const theirs = SecretToken.issue();
      await harness.repository.issue({
        id: RefreshTokenId.create(),
        sessionId: SessionId.create(),
        userId: UserId.create(otherId),
        tokenHash: theirs.hash,
        expiresAt: future,
      });

      await harness.repository.revokeAllForUser(UserId.create(userId), now);

      await expect(
        harness.repository.rotate(theirs.hash, successor(), now),
      ).resolves.toMatchObject({ outcome: 'rotated' });
    });
  });
}
