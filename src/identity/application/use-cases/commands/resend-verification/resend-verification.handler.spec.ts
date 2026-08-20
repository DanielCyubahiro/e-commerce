import { Logger } from '@nestjs/common';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { InMemoryOneTimeTokenRepository } from '@test/fakes/in-memory-one-time-token.repository';
import { RecordingEmailSender } from '@test/fakes/recording-email.sender';
import { SecretToken, TokenPurpose } from '@/identity/domain';
import { ResendVerificationCommand } from './resend-verification.command';
import { ResendVerificationHandler } from './resend-verification.handler';

describe('ResendVerificationHandler', () => {
  // Silences the transport-failure case's deliberate ERROR log, exactly as
  // RegisterUserHandler's suite does for the same reason.
  Logger.overrideLogger(false);

  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  const lifetimes = {
    refreshTokenDays: 30,
    passwordResetMinutes: 60,
    emailVerificationHours: 24,
  };

  let tokens: InMemoryOneTimeTokenRepository;
  let credentials: InMemoryCredentialRepository;
  let email: RecordingEmailSender;
  let handler: ResendVerificationHandler;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T10:00:00.000Z'));
    tokens = new InMemoryOneTimeTokenRepository();
    credentials = new InMemoryCredentialRepository();
    email = new RecordingEmailSender();
    handler = new ResendVerificationHandler(
      tokens,
      credentials,
      email,
      lifetimes,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('issues and mails a fresh token for an unverified account', async () => {
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: 'hash-1',
      emailVerifiedAt: null,
    });

    await handler.execute(new ResendVerificationCommand('ada@example.com'));

    const sent = email.sent();
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe('ada@example.com');

    // Proves a real, consumable token was issued for this user, not just that
    // something was mailed: the plaintext survives only in the sent message,
    // exactly as RegisterUserHandler's own suite checks it.
    const token = sent[0]?.body.replace('verify with ', '') ?? '';
    await expect(
      tokens.consume(
        SecretToken.hashOf(token),
        TokenPurpose.emailVerification(),
        new Date('2026-08-19T10:00:00.000Z'),
      ),
    ).resolves.toEqual({ outcome: 'consumed', userId });
  });

  it('issues nothing and mails nothing for an address nobody holds', async () => {
    await expect(
      handler.execute(new ResendVerificationCommand('nobody@example.com')),
    ).resolves.toBeUndefined();

    expect(email.sent()).toHaveLength(0);
    expect(tokens.size()).toBe(0);
  });

  it('issues nothing and mails nothing for an already-verified account', async () => {
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: 'hash-1',
      emailVerifiedAt: new Date('2026-08-01T00:00:00.000Z'),
    });

    await expect(
      handler.execute(new ResendVerificationCommand('ada@example.com')),
    ).resolves.toBeUndefined();

    expect(email.sent()).toHaveLength(0);
    expect(tokens.size()).toBe(0);
  });

  it('still resolves when the transport rejects, since the token is already issued', async () => {
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: 'hash-1',
      emailVerifiedAt: null,
    });
    jest
      .spyOn(email, 'sendEmailVerification')
      .mockRejectedValue(new Error('smtp down'));

    await expect(
      handler.execute(new ResendVerificationCommand('ada@example.com')),
    ).resolves.toBeUndefined();
  });

  it('still resolves when the transport rejects with a non-Error value', async () => {
    // A transport can reject with anything, not only an Error; the logging
    // path has a separate branch for that so `.stack` is never read off a
    // value that lacks it.
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: 'hash-1',
      emailVerifiedAt: null,
    });
    jest.spyOn(email, 'sendEmailVerification').mockRejectedValue('smtp down');

    await expect(
      handler.execute(new ResendVerificationCommand('ada@example.com')),
    ).resolves.toBeUndefined();
  });
});
