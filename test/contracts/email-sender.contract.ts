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

      const sent = await harness.sent();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.to).toBe('ada@example.com');
    });

    it('puts the verification token in the body, so a user can act on it', async () => {
      await harness.sender.sendEmailVerification(recipient, 'token-abc');

      expect((await harness.sent())[0]?.body).toContain('token-abc');
    });

    it('delivers a reset message distinguishable from a verification one', async () => {
      await harness.sender.sendPasswordReset(recipient, 'token-xyz');

      const sent = await harness.sent();
      expect(sent).toHaveLength(1);
      expect(sent[0]?.body).toContain('token-xyz');
      expect(sent[0]?.subject).not.toBe('');
    });

    it('sends the two kinds under different subjects', async () => {
      await harness.sender.sendEmailVerification(recipient, 'token-abc');
      await harness.sender.sendPasswordReset(recipient, 'token-xyz');

      const [verification, reset] = await harness.sent();
      expect(verification?.subject).not.toBe(reset?.subject);
    });

    it('never puts one flow’s token in the other flow’s message', async () => {
      await harness.sender.sendEmailVerification(recipient, 'token-abc');

      expect((await harness.sent())[0]?.body).not.toContain('token-xyz');
    });
  });
}
