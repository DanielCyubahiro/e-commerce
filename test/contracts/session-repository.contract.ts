import type {
  SessionOrigin,
  SessionRepository,
  TokenLifetimes,
} from '@/identity/application';
import { SecretToken, SessionId, UserId } from '@/identity/domain';

export interface SessionHarness {
  repository: SessionRepository;
  /** Creates a user row the sessions can reference. Returns its id. */
  seedUser(email: string, role: string): Promise<string>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

/**
 * Both bindings construct their repository with these, so every date below
 * means the same thing to the fake and to Postgres.
 */
export const CONTRACT_LIFETIMES: TokenLifetimes = {
  passwordResetMinutes: 60,
  emailVerificationHours: 24,
  sessionIdleDays: 30,
  sessionAbsoluteDays: 365,
};

const DAY = 86_400_000;
const daysAfter = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * DAY);

export function sessionRepositoryContract(
  name: string,
  makeHarness: () => Promise<SessionHarness>,
): void {
  describe(`SessionRepository contract (${name})`, () => {
    let harness: SessionHarness;
    let userId: string;

    const t0 = new Date('2026-08-19T10:00:00.000Z');
    const noOrigin: SessionOrigin = { userAgent: null, ipAddress: null };

    const start = async (
      secret: SecretToken,
      options: { owner?: string; at?: Date; origin?: SessionOrigin } = {},
    ): Promise<SessionId> => {
      const id = SessionId.create();
      await harness.repository.start(
        {
          id,
          userId: UserId.create(options.owner ?? userId),
          tokenHash: secret.hash,
          origin: options.origin ?? noOrigin,
        },
        options.at ?? t0,
      );
      return id;
    };

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

    it('touches a fresh session and answers the owner with a live role', async () => {
      const secret = SecretToken.issue();
      const sessionId = await start(secret);

      await expect(
        harness.repository.touch(secret.hash, daysAfter(t0, 1)),
      ).resolves.toEqual({
        userId,
        role: 'seller',
        sessionId: sessionId.value,
      });
    });

    it('answers null for a digest nobody issued', async () => {
      await expect(
        harness.repository.touch(SecretToken.issue().hash, t0),
      ).resolves.toBeNull();
    });

    it('extends the idle window on every touch', async () => {
      const touched = SecretToken.issue();
      const untouched = SecretToken.issue();
      await start(touched);
      await start(untouched);

      // Day 20 keeps `touched` alive through day 40, which is past the idle
      // window measured from login. `untouched` proves the window is real.
      await expect(
        harness.repository.touch(touched.hash, daysAfter(t0, 20)),
      ).resolves.not.toBeNull();
      await expect(
        harness.repository.touch(touched.hash, daysAfter(t0, 40)),
      ).resolves.not.toBeNull();
      await expect(
        harness.repository.touch(untouched.hash, daysAfter(t0, 31)),
      ).resolves.toBeNull();
    });

    it('lets the absolute cap win over touching', async () => {
      const secret = SecretToken.issue();
      await start(secret);

      for (let day = 20; day <= 360; day += 20) {
        await expect(
          harness.repository.touch(secret.hash, daysAfter(t0, day)),
        ).resolves.not.toBeNull();
      }

      await expect(
        harness.repository.touch(secret.hash, daysAfter(t0, 366)),
      ).resolves.toBeNull();
    });

    it('answers null once revoked, and revoke reports true only once', async () => {
      const secret = SecretToken.issue();
      const sessionId = await start(secret);
      const owner = UserId.create(userId);

      await expect(
        harness.repository.revoke(sessionId, owner, t0),
      ).resolves.toBe(true);
      await expect(
        harness.repository.touch(secret.hash, t0),
      ).resolves.toBeNull();
      await expect(
        harness.repository.revoke(sessionId, owner, t0),
      ).resolves.toBe(false);
    });

    it('refuses to revoke another user’s session, and does not say why', async () => {
      const other = await harness.seedUser('grace@example.com', 'customer');
      const secret = SecretToken.issue();
      const sessionId = await start(secret);

      await expect(
        harness.repository.revoke(sessionId, UserId.create(other), t0),
      ).resolves.toBe(false);
      await expect(
        harness.repository.touch(secret.hash, t0),
      ).resolves.not.toBeNull();
    });

    it('reports false for a session id nobody holds', async () => {
      await expect(
        harness.repository.revoke(
          SessionId.create(),
          UserId.create(userId),
          t0,
        ),
      ).resolves.toBe(false);
    });

    it('revokes every session of a user except the one spared', async () => {
      const other = await harness.seedUser('grace@example.com', 'customer');
      const spared = SecretToken.issue();
      const doomed = SecretToken.issue();
      const someoneElses = SecretToken.issue();
      const sparedId = await start(spared);
      await start(doomed);
      await start(someoneElses, { owner: other });

      await harness.repository.revokeAllForUser(
        UserId.create(userId),
        t0,
        sparedId,
      );

      await expect(
        harness.repository.touch(spared.hash, t0),
      ).resolves.not.toBeNull();
      await expect(
        harness.repository.touch(doomed.hash, t0),
      ).resolves.toBeNull();
      await expect(
        harness.repository.touch(someoneElses.hash, t0),
      ).resolves.not.toBeNull();
    });

    it('revokes every session of a user when nothing is spared', async () => {
      const first = SecretToken.issue();
      const second = SecretToken.issue();
      await start(first);
      await start(second);

      await harness.repository.revokeAllForUser(UserId.create(userId), t0);

      await expect(
        harness.repository.touch(first.hash, t0),
      ).resolves.toBeNull();
      await expect(
        harness.repository.touch(second.hash, t0),
      ).resolves.toBeNull();
    });

    it('lists live sessions most recently seen first, with their origins', async () => {
      const firefox = SecretToken.issue();
      const safari = SecretToken.issue();
      const firefoxId = await start(firefox, {
        origin: { userAgent: 'Firefox', ipAddress: '10.0.0.1' },
      });
      const safariId = await start(safari, {
        origin: { userAgent: 'Safari', ipAddress: null },
      });
      await harness.repository.touch(firefox.hash, daysAfter(t0, 1));

      await expect(
        harness.repository.listLiveForUser(
          UserId.create(userId),
          daysAfter(t0, 2),
        ),
      ).resolves.toEqual([
        {
          id: firefoxId.value,
          userAgent: 'Firefox',
          ipAddress: '10.0.0.1',
          createdAt: t0,
          lastSeenAt: daysAfter(t0, 1),
        },
        {
          id: safariId.value,
          userAgent: 'Safari',
          ipAddress: null,
          createdAt: t0,
          lastSeenAt: t0,
        },
      ]);
    });

    it('leaves revoked, expired and other users’ sessions out of the list', async () => {
      const other = await harness.seedUser('grace@example.com', 'customer');
      const live = SecretToken.issue();
      const revoked = SecretToken.issue();
      const stale = SecretToken.issue();
      const liveId = await start(live);
      const revokedId = await start(revoked);
      await start(stale, { at: daysAfter(t0, -40) });
      await start(SecretToken.issue(), { owner: other });
      await harness.repository.revoke(revokedId, UserId.create(userId), t0);

      const listed = await harness.repository.listLiveForUser(
        UserId.create(userId),
        t0,
      );

      expect(listed.map((row) => row.id)).toEqual([liveId.value]);
    });
  });
}
