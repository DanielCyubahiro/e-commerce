import { Logger } from '@nestjs/common';
import { catchRejection } from '@test/support/catch-error';
import { FakePasswordHasher } from '@test/fakes/fake-password.hasher';
import { InMemoryUserWriteRepository } from '@test/fakes/in-memory-user-write.repository';
import { RecordingEmailSender } from '@test/fakes/recording-email.sender';
import { InvalidPasswordException, PasswordAttempt } from '@/identity/domain';
import { DuplicateEmailException } from '../../../exceptions/duplicate-email.exception';
import { RegisterUserCommand } from './register-user.command';
import { RegisterUserHandler } from './register-user.handler';

describe('RegisterUserHandler', () => {
  // The handler constructs its own `Logger`, outside any Nest app context, so
  // the two send-failure cases below would otherwise print a real ERROR line:
  // expected, since that is exactly what they assert happened, but silenced so
  // a green run stays quiet.
  Logger.overrideLogger(false);

  let users: InMemoryUserWriteRepository;
  let hasher: FakePasswordHasher;
  let email: RecordingEmailSender;
  let handler: RegisterUserHandler;

  const lifetimes = {
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
    sessionIdleDays: 30,
    sessionAbsoluteDays: 365,
  };

  const command = (over: { email?: string; password?: string } = {}) =>
    new RegisterUserCommand(
      {
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: over.email ?? 'ada@example.com',
        role: 'seller',
      },
      over.password ?? 'correct horse battery',
    );

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T10:00:00.000Z'));
    users = new InMemoryUserWriteRepository();
    hasher = new FakePasswordHasher();
    email = new RecordingEmailSender();
    handler = new RegisterUserHandler(users, hasher, email, lifetimes);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('stores the user and returns only its id', async () => {
    const id = await handler.execute(command());

    expect(users.snapshot()).toHaveLength(1);
    expect(users.snapshot()[0]?.id.value).toBe(id);
  });

  it('stores a hash, never the password itself', async () => {
    await handler.execute(command());

    const [stored] = users.registrations();
    if (!stored) {
      throw new Error('expected a registration to have been recorded');
    }
    // FakePasswordHasher's own hash embeds the plaintext after its second
    // colon (by design, so its `verify` can work without real crypto), so
    // this cannot assert the raw password is absent from the string; it
    // asserts the stored value is not the password unhashed, which is the
    // bug this test exists to catch.
    expect(stored.passwordHash.value).not.toBe('correct horse battery');
    await expect(
      hasher.verify(
        PasswordAttempt.create('correct horse battery'),
        stored.passwordHash,
      ),
    ).resolves.toBe(true);
  });

  it('rejects a password below the policy before anything is written', async () => {
    const error = await catchRejection(
      () => handler.execute(command({ password: 'short' })),
      InvalidPasswordException,
    );

    expect(error.code).toBe('USER_PASSWORD_INVALID');
    expect(users.snapshot()).toHaveLength(0);
  });

  it('issues a verification token expiring after the configured lifetime', async () => {
    await handler.execute(command());

    expect(users.registrations()[0]?.verification.expiresAt).toEqual(
      new Date('2026-08-20T10:00:00.000Z'),
    );
  });

  it('emails the verification token, and stores only its digest', async () => {
    await handler.execute(command());

    const sent = email.sent();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('ada@example.com');

    const [registration] = users.registrations();
    if (!registration) {
      throw new Error('expected a registration to have been recorded');
    }
    const stored = registration.verification.tokenHash.value;
    expect(sent[0]?.body).not.toContain(stored);
    expect(stored).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sends the mail only after the write, never before', async () => {
    // Proven by the failure direction: a rejected write must leave no mail.
    await handler.execute(command());
    await catchRejection(
      () => handler.execute(command()),
      DuplicateEmailException,
    );

    expect(email.sent()).toHaveLength(1);
  });

  it('still reports success when the mail fails, because the account exists', async () => {
    // Registration is durable by then, so a 500 would report the opposite of
    // what happened and a retry would answer 409. Recovery is the resend
    // endpoint.
    jest
      .spyOn(email, 'sendEmailVerification')
      .mockRejectedValue(new Error('smtp down'));

    await expect(handler.execute(command())).resolves.toEqual(
      expect.any(String),
    );
    expect(users.snapshot()).toHaveLength(1);
  });

  it('still reports success when the transport rejects with a non-Error value', async () => {
    // A transport can reject with anything, not only an Error; the logging
    // path has a separate branch for that so `.stack` is never read off a
    // value that lacks it.
    jest.spyOn(email, 'sendEmailVerification').mockRejectedValue('smtp down');

    await expect(handler.execute(command())).resolves.toEqual(
      expect.any(String),
    );
  });

  it('lets a duplicate email surface from the port rather than pre-checking', async () => {
    await handler.execute(command());

    const error = await catchRejection(
      () => handler.execute(command()),
      DuplicateEmailException,
    );

    expect(error.code).toBe('USER_EMAIL_DUPLICATE');
  });
});
