import { catchRejection } from '@test/support/catch-error';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { InMemoryOneTimeTokenRepository } from '@test/fakes/in-memory-one-time-token.repository';
import {
  Email,
  OneTimeTokenId,
  SecretToken,
  TokenPurpose,
  UserId,
} from '@/identity/domain';
import { InvalidVerificationTokenException } from '../../../exceptions/invalid-verification-token.exception';
import { VerifyEmailCommand } from './verify-email.command';
import { VerifyEmailHandler } from './verify-email.handler';

describe('VerifyEmailHandler', () => {
  const userId = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
  let tokens: InMemoryOneTimeTokenRepository;
  let credentials: InMemoryCredentialRepository;
  let handler: VerifyEmailHandler;

  const issueToken = async (secret: SecretToken, expiresAt: Date) => {
    await tokens.issue({
      id: OneTimeTokenId.create(),
      purpose: TokenPurpose.emailVerification(),
      userId: UserId.create(userId),
      tokenHash: secret.hash,
      expiresAt,
    });
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T10:00:00.000Z'));
    tokens = new InMemoryOneTimeTokenRepository();
    credentials = new InMemoryCredentialRepository();
    credentials.seed({
      userId,
      email: 'ada@example.com',
      role: 'seller',
      passwordHash: 'hash-1',
      emailVerifiedAt: null,
    });
    handler = new VerifyEmailHandler(tokens, credentials);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('marks the email verified at the current time', async () => {
    const secret = SecretToken.issue();
    await issueToken(secret, new Date('2026-08-20T10:00:00.000Z'));

    await handler.execute(new VerifyEmailCommand(secret.plaintext));

    await expect(
      credentials.findPasswordHash(UserId.create(userId)),
    ).resolves.not.toBeNull();
    const record = await credentials.findAuthentication(
      Email.create('ada@example.com'),
    );
    expect(record?.emailVerifiedAt).toEqual(
      new Date('2026-08-19T10:00:00.000Z'),
    );
  });

  it('succeeds again when the same link is followed twice, without rewriting the timestamp', async () => {
    // A double-clicked link, or a mail client that prefetches. The token was
    // already consumed, so verification already happened: reporting an error
    // would contradict the state.
    const secret = SecretToken.issue();
    await issueToken(secret, new Date('2026-08-20T10:00:00.000Z'));
    await handler.execute(new VerifyEmailCommand(secret.plaintext));

    // The clock has to move, or a regression that verified a second time
    // would write an identical timestamp and this assertion would pass by
    // coincidence.
    jest.setSystemTime(new Date('2026-08-19T11:00:00.000Z'));

    await expect(
      handler.execute(new VerifyEmailCommand(secret.plaintext)),
    ).resolves.toBeUndefined();

    const record = await credentials.findAuthentication(
      Email.create('ada@example.com'),
    );
    expect(record?.emailVerifiedAt).toEqual(
      new Date('2026-08-19T10:00:00.000Z'),
    );
  });

  it('reports an expired link distinctly, so the user knows to ask for another', async () => {
    const secret = SecretToken.issue();
    await issueToken(secret, new Date('2026-08-19T09:00:00.000Z'));

    const error = await catchRejection(
      () => handler.execute(new VerifyEmailCommand(secret.plaintext)),
      InvalidVerificationTokenException,
    );

    expect(error.code).toBe('AUTH_VERIFICATION_TOKEN_EXPIRED');
  });

  it('rejects a token nobody issued', async () => {
    const error = await catchRejection(
      () => handler.execute(new VerifyEmailCommand('not-a-real-token')),
      InvalidVerificationTokenException,
    );

    expect(error.code).toBe('AUTH_VERIFICATION_TOKEN_INVALID');
  });

  it('refuses a password-reset token presented here', async () => {
    const secret = SecretToken.issue();
    await tokens.issue({
      id: OneTimeTokenId.create(),
      purpose: TokenPurpose.passwordReset(),
      userId: UserId.create(userId),
      tokenHash: secret.hash,
      expiresAt: new Date('2026-08-20T10:00:00.000Z'),
    });

    const error = await catchRejection(
      () => handler.execute(new VerifyEmailCommand(secret.plaintext)),
      InvalidVerificationTokenException,
    );

    expect(error.code).toBe('AUTH_VERIFICATION_TOKEN_INVALID');
  });
});
