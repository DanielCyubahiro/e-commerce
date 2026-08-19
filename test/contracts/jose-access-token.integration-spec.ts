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
