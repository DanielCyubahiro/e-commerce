import { catchRejection } from '@test/support/catch-error';
import { FakePasswordHasher } from '@test/fakes/fake-password.hasher';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { InMemorySessionRepository } from '@test/fakes/in-memory-session.repository';
import {
  InvalidPasswordException,
  Password,
  PasswordAttempt,
  SecretToken,
  SessionId,
  UserId,
} from '@/identity/domain';
import { InvalidCredentialsException } from '../../../exceptions/invalid-credentials.exception';
import { ChangePasswordCommand } from './change-password.command';
import { ChangePasswordHandler } from './change-password.handler';

describe('ChangePasswordHandler', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const now = new Date('2026-08-19T10:00:00.000Z');
  const lifetimes = {
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };

  let credentials: InMemoryCredentialRepository;
  let sessions: InMemorySessionRepository;
  let hasher: FakePasswordHasher;
  let handler: ChangePasswordHandler;
  let storedHash: string;
  let mySession: SessionId;

  const startSession = async (): Promise<SessionId> => {
    const sessionId = SessionId.create();
    await sessions.start(
      {
        id: sessionId,
        userId: UserId.create(userId),
        tokenHash: SecretToken.issue().hash,
        origin: { userAgent: null, ipAddress: null },
      },
      now,
    );
    return sessionId;
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(now);
    credentials = new InMemoryCredentialRepository();
    sessions = new InMemorySessionRepository(lifetimes);
    sessions.seedUserRole(userId, 'seller');
    hasher = new FakePasswordHasher();
    handler = new ChangePasswordHandler(credentials, hasher, sessions);

    storedHash = (await hasher.hash(Password.create('correct horse battery')))
      .value;
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: storedHash,
      emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    mySession = await startSession();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('changes the password when the current one is right', async () => {
    await handler.execute(
      new ChangePasswordCommand(
        userId,
        mySession.value,
        'correct horse battery',
        'a new long password',
      ),
    );

    const stored = await credentials.findPasswordHash(UserId.create(userId));
    if (stored === null) {
      throw new Error('Expected a stored password hash after the change.');
    }
    await expect(
      hasher.verify(PasswordAttempt.create('a new long password'), stored),
    ).resolves.toBe(true);
  });

  it('refuses a wrong current password', async () => {
    // A live session proves someone holds a cookie, not that they are the
    // account owner. Without this check a stolen cookie becomes permanent
    // account takeover for as long as the session lives.
    const error = await catchRejection(
      () =>
        handler.execute(
          new ChangePasswordCommand(
            userId,
            mySession.value,
            'wrong',
            'a new long password',
          ),
        ),
      InvalidCredentialsException,
    );

    expect(error.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('leaves the stored hash alone when the current password is wrong', async () => {
    await catchRejection(
      () =>
        handler.execute(
          new ChangePasswordCommand(
            userId,
            mySession.value,
            'wrong',
            'a new long password',
          ),
        ),
      InvalidCredentialsException,
    );

    const stored = await credentials.findPasswordHash(UserId.create(userId));
    expect(stored?.value).toBe(storedHash);
  });

  it('revokes other sessions but keeps the caller’s', async () => {
    const otherSession = await startSession();

    await handler.execute(
      new ChangePasswordCommand(
        userId,
        mySession.value,
        'correct horse battery',
        'a new long password',
      ),
    );

    const rows = sessions.rows();
    expect(
      rows.find((row) => row.id === mySession.value)?.revokedAt,
    ).toBeNull();
    expect(
      rows.find((row) => row.id === otherSession.value)?.revokedAt,
    ).not.toBeNull();
  });

  it('rejects a weak new password without touching anything', async () => {
    const error = await catchRejection(
      () =>
        handler.execute(
          new ChangePasswordCommand(
            userId,
            mySession.value,
            'correct horse battery',
            'short',
          ),
        ),
      InvalidPasswordException,
    );

    expect(error.code).toBe('USER_PASSWORD_INVALID');
    const stored = await credentials.findPasswordHash(UserId.create(userId));
    expect(stored?.value).toBe(storedHash);
    expect(
      sessions.rows().find((row) => row.id === mySession.value)?.revokedAt,
    ).toBeNull();
  });
});
