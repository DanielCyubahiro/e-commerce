import type { Page } from '@/shared/application';
import type {
  Registration,
  UserReadModel,
  UserReadRepository,
  UserWriteRepository,
} from '@/identity/application';
import {
  OneTimeTokenId,
  PasswordHash,
  SecretToken,
  User,
  UserId,
  UserProfile,
} from '@/identity/domain';

export interface ReadHarness {
  read: UserReadRepository;
  /** Seeding goes through the write port, so the contract never assumes how rows are inserted. */
  write: UserWriteRepository;
  reset(): Promise<void>;
  close(): Promise<void>;
}

export function userReadRepositoryContract(
  name: string,
  makeHarness: () => Promise<ReadHarness>,
): void {
  describe(`UserReadRepository contract (${name})`, () => {
    let harness: ReadHarness;

    const aRegistration = (user: User): Registration => ({
      user,
      passwordHash: PasswordHash.create('hash-1'),
      verification: {
        id: OneTimeTokenId.create(),
        tokenHash: SecretToken.issue().hash,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const store = async (overrides: {
      email?: string;
      role?: string;
      phone?: string | null;
    }): Promise<User> => {
      const user = User.create({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: overrides.email ?? 'ada@example.com',
        role: overrides.role ?? 'seller',
        phone: overrides.phone ?? null,
      });
      await harness.write.register(aRegistration(user));
      return user;
    };

    const page = (): { limit: number; offset: number } => ({
      limit: 20,
      offset: 0,
    });

    const aProfile = (): UserProfile =>
      UserProfile.create({
        firstName: 'Grace',
        lastName: 'Hopper',
        role: 'customer',
        phone: '+15551234567',
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

    it('returns null when no user holds the id', async () => {
      await expect(harness.read.findById(UserId.create())).resolves.toBeNull();
    });

    it('projects every stored field', async () => {
      const user = await store({ phone: '+32489123456' });

      const found = await harness.read.findById(user.id);

      expect(found).toEqual({
        id: user.id.value,
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        role: 'seller',
        phone: '+32489123456',
        createdAt: expect.any(Date) as Date,
        updatedAt: expect.any(Date) as Date,
      });
    });

    it('projects an absent phone as null, never undefined', async () => {
      const user = await store({ phone: null });

      const found = await harness.read.findById(user.id);

      expect(found?.phone).toBeNull();
    });

    describe('after a profile replacement', () => {
      it('projects the replaced values, with the email untouched', async () => {
        const user = await store({ email: 'ada@example.com' });

        await harness.write.replaceProfile(user.id, aProfile());

        expect(await harness.read.findById(user.id)).toMatchObject({
          id: user.id.value,
          firstName: 'Grace',
          lastName: 'Hopper',
          email: 'ada@example.com',
          role: 'customer',
          phone: '+15551234567',
        });
      });

      it('moves updatedAt without moving createdAt', async () => {
        const user = await store({});
        const before = await harness.read.findById(user.id);

        await harness.write.replaceProfile(user.id, aProfile());

        const after = await harness.read.findById(user.id);
        expect(after?.createdAt).toEqual(before?.createdAt);
        expect(after?.updatedAt.getTime()).toBeGreaterThan(
          before?.updatedAt.getTime() ?? 0,
        );
      });

      it('keeps its position in the newest-first order', async () => {
        const older = await store({ email: 'older@example.com' });
        const newer = await store({ email: 'newer@example.com' });

        await harness.write.replaceProfile(older.id, aProfile());

        const found = await harness.read.findMany({}, page());

        expect(found.items.map((item) => item.id)).toEqual([
          newer.id.value,
          older.id.value,
        ]);
      });
    });

    it('filters by role', async () => {
      await store({ email: 'seller@example.com', role: 'seller' });
      await store({ email: 'customer@example.com', role: 'customer' });

      const found: Page<UserReadModel> = await harness.read.findMany(
        { role: 'customer' },
        page(),
      );

      expect(found.items.map((item) => item.email)).toEqual([
        'customer@example.com',
      ]);
      expect(found.total).toBe(1);
    });

    it('returns every user when no filter is given', async () => {
      await store({ email: 'one@example.com' });
      await store({ email: 'two@example.com' });

      const found = await harness.read.findMany({}, page());

      expect(found.total).toBe(2);
    });

    it('orders newest first', async () => {
      await store({ email: 'first@example.com' });
      await store({ email: 'second@example.com' });

      const found = await harness.read.findMany({}, page());

      expect(found.items.map((item) => item.email)).toEqual([
        'second@example.com',
        'first@example.com',
      ]);
    });

    it('honours limit and offset while reporting the unpaged total', async () => {
      await store({ email: 'one@example.com' });
      await store({ email: 'two@example.com' });
      await store({ email: 'three@example.com' });

      const found = await harness.read.findMany({}, { limit: 1, offset: 1 });

      expect(found.items).toHaveLength(1);
      expect(found.total).toBe(3);
      expect(found.limit).toBe(1);
      expect(found.offset).toBe(1);
    });

    it('reports the total past the end of the results', async () => {
      await store({ email: 'one@example.com' });

      const found = await harness.read.findMany({}, { limit: 10, offset: 10 });

      expect(found.items).toHaveLength(0);
      expect(found.total).toBe(1);
    });

    it('reports zero total on an empty store', async () => {
      const found = await harness.read.findMany({}, page());

      expect(found).toMatchObject({ items: [], total: 0 });
    });

    it('reports the filtered total past the end, not the total of every user', async () => {
      await store({ email: 'seller@example.com', role: 'seller' });
      await store({ email: 'customer@example.com', role: 'customer' });

      const found = await harness.read.findMany(
        { role: 'customer' },
        { limit: 10, offset: 10 },
      );

      expect(found.items).toHaveLength(0);
      expect(found.total).toBe(1);
    });
  });
}
