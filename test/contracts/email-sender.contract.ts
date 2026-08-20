import type { EmailSender } from '@/identity/application';
import { Email } from '@/identity/domain';

export interface SentMessage {
  to: string;
  subject: string;
  body: string;
}

export interface SenderHarness {
  sender: EmailSender;
  /** Every message the transport has accepted since the last `reset`. */
  sent(): Promise<SentMessage[]>;
  reset(): Promise<void>;
  close(): Promise<void>;
}

const POLL_INTERVAL_MS = 25;
const POLL_TIMEOUT_MS = 2_000;

/**
 * `sendMail` resolves on SMTP acceptance (see the SMTP port's own comment),
 * not on the message becoming visible through Mailpit's HTTP API, so a single
 * read after `send` can observe zero or a partial set. Poll until the count
 * this call expects shows up, or fail with a useful message once the deadline
 * passes, rather than asserting on whatever happened to have landed yet.
 */
async function waitForMessages(
  harness: SenderHarness,
  expectedCount: number,
): Promise<SentMessage[]> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let sent: SentMessage[] = [];

  do {
    sent = await harness.sent();
    if (sent.length >= expectedCount) return sent;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  } while (Date.now() < deadline);

  throw new Error(
    `Expected at least ${expectedCount} sent message(s), found ${sent.length} after ${POLL_TIMEOUT_MS}ms`,
  );
}

/**
 * Both implementations have to agree on what reaches the transport, not just
 * that `send` resolved. The fake records; the SMTP adapter's messages are read
 * back out of Mailpit over HTTP.
 */
export function emailSenderContract(
  name: string,
  makeHarness: () => Promise<SenderHarness>,
): void {
  describe(`EmailSender contract (${name})`, () => {
    let harness: SenderHarness;

    const recipient = Email.create('ada@example.com');

    beforeAll(async () => {
      harness = await makeHarness();
    });

    beforeEach(async () => {
      await harness.reset();
    });

    afterAll(async () => {
      await harness.close();
    });

    it('delivers a verification message to the address given', async () => {
      await harness.sender.sendEmailVerification(recipient, 'token-abc');

      const sent = await waitForMessages(harness, 1);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.to).toBe('ada@example.com');
    });

    it('puts the verification token in the body, so a user can act on it', async () => {
      await harness.sender.sendEmailVerification(recipient, 'token-abc');

      expect((await waitForMessages(harness, 1))[0]?.body).toContain(
        'token-abc',
      );
    });

    it('delivers a reset message carrying its own token', async () => {
      await harness.sender.sendPasswordReset(recipient, 'token-xyz');

      const sent = await waitForMessages(harness, 1);
      expect(sent).toHaveLength(1);
      expect(sent[0]?.body).toContain('token-xyz');
      expect(sent[0]?.subject).not.toBe('');
    });

    it('sends the two kinds under different subjects', async () => {
      await harness.sender.sendEmailVerification(recipient, 'token-abc');
      await harness.sender.sendPasswordReset(recipient, 'token-xyz');

      const [verification, reset] = await waitForMessages(harness, 2);
      expect(verification?.subject).not.toBe(reset?.subject);
    });

    it('never puts one flow’s token in the other flow’s message', async () => {
      // Both tokens have to be in play for this to mean anything: asserting
      // that a token never handed to `sendEmailVerification` is absent from its
      // message passes for every implementation, leaky ones included.
      await harness.sender.sendPasswordReset(recipient, 'token-xyz');
      await harness.sender.sendEmailVerification(recipient, 'token-abc');

      const [reset, verification] = await waitForMessages(harness, 2);
      expect(reset?.body).toContain('token-xyz');
      expect(reset?.body).not.toContain('token-abc');
      expect(verification?.body).toContain('token-abc');
      expect(verification?.body).not.toContain('token-xyz');
    });
  });
}
