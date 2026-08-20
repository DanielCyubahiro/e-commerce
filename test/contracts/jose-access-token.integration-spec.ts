import { SignJWT } from 'jose';
import { JoseAccessTokenIssuer } from '@/identity/infrastructure';

// Outside the shared contract, the same way drizzle-user-write.integration-spec
// covers the updated_at trigger: expiry is real-clock behaviour the fake has no
// way to reproduce, so holding the fake to it would only make the fake lie
// more elaborately.
describe('JoseAccessTokenIssuer expiry', () => {
  const claims = {
    userId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
    role: 'customer',
    sessionId: '9c858901-8a57-4791-81fe-4c455b099bc9',
  };

  it('refuses a token whose lifetime has passed', async () => {
    // Time is moved rather than a negative lifetime passed: the adapter builds a
    // duration string from its lifetime, and a negative one is not an input jose
    // documents. jose reads `Date.now()`, which fake timers control.
    jest.useFakeTimers().setSystemTime(new Date('2026-08-19T10:00:00.000Z'));
    const issuer = new JoseAccessTokenIssuer('a'.repeat(32), 900);
    const { token } = await issuer.issue(claims);

    jest.setSystemTime(new Date('2026-08-19T10:16:00.000Z'));

    await expect(issuer.verify(token)).resolves.toBeNull();
    jest.useRealTimers();
  });

  it('accepts a token still inside its lifetime', async () => {
    const issuer = new JoseAccessTokenIssuer('a'.repeat(32), 900);

    const { token } = await issuer.issue(claims);

    await expect(issuer.verify(token)).resolves.toEqual(claims);
  });
});

// Also outside the shared contract: the fake cannot produce a validly-signed
// token missing a claim, since it only ever encodes what it was given. The
// guard this covers exists for a token something other than this adapter
// signed, not for anything issue() itself can produce.
describe('JoseAccessTokenIssuer, a token this adapter did not shape', () => {
  it('returns null for a validly-signed token missing a claim', async () => {
    const secret = 'a'.repeat(32);
    const issuer = new JoseAccessTokenIssuer(secret, 900);

    // Bypasses issue(), which always sets all three claims, so the missing
    // `sid` here could only come from something else that signed with the
    // same secret.
    const token = await new SignJWT({ role: 'customer' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('3f2504e0-4f89-41d3-9a0c-0305e82c3301')
      .setIssuedAt()
      .setExpirationTime('900s')
      .sign(new TextEncoder().encode(secret));

    await expect(issuer.verify(token)).resolves.toBeNull();
  });
});
