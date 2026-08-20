import type { AccessTokenIssuer } from '@/identity/application';

export interface IssuerHarness {
  issuer: AccessTokenIssuer;
  /** A second issuer holding a different secret. Its tokens must be refused. */
  foreign: AccessTokenIssuer;
}

export function accessTokenIssuerContract(
  name: string,
  makeHarness: () => Promise<IssuerHarness>,
): void {
  describe(`AccessTokenIssuer contract (${name})`, () => {
    let harness: IssuerHarness;

    const claims = {
      userId: '3f2504e0-4f89-41d3-9a0c-0305e82c3301',
      role: 'seller',
      sessionId: '9c858901-8a57-4791-81fe-4c455b099bc9',
    };

    beforeAll(async () => {
      harness = await makeHarness();
    });

    it('round-trips every claim it was given', async () => {
      const { token } = await harness.issuer.issue(claims);

      await expect(harness.issuer.verify(token)).resolves.toEqual(claims);
    });

    it('reports the lifetime it used', async () => {
      const issued = await harness.issuer.issue(claims);

      expect(issued.expiresInSeconds).toBeGreaterThan(0);
    });

    it('returns null for an empty token', async () => {
      await expect(harness.issuer.verify('')).resolves.toBeNull();
    });

    it('returns null for a token-shaped string it did not issue', async () => {
      await expect(
        harness.issuer.verify('not.a.real.token'),
      ).resolves.toBeNull();
    });

    it('returns null for a token from an issuer holding another secret', async () => {
      const { token } = await harness.foreign.issue(claims);

      await expect(harness.issuer.verify(token)).resolves.toBeNull();
    });

    it('does not accept its own token at the foreign issuer either', async () => {
      const { token } = await harness.issuer.issue(claims);

      await expect(harness.foreign.verify(token)).resolves.toBeNull();
    });
  });
}
