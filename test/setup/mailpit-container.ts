import { GenericContainer, type StartedTestContainer } from 'testcontainers';

export interface MailpitHandle {
  host: string;
  smtpPort: number;
  /** Every message Mailpit currently holds, oldest first. */
  messages(): Promise<{ to: string; subject: string; body: string }[]>;
  clear(): Promise<void>;
  stop(): Promise<void>;
}

interface MailpitSummary {
  messages: { ID: string; Subject: string; To: { Address: string }[] }[];
}

interface MailpitMessage {
  Text: string;
}

/**
 * Started per-suite rather than in the integration project's globalSetup: one
 * binding needs it, and paying for a second container on every integration run
 * would slow suites that never send mail.
 */
export async function startMailpit(): Promise<MailpitHandle> {
  // Pinned like postgres-container.ts and docker-compose.yml's mongo service.
  // Mailpit publishes no bare major tag, so v1.30 (the current minor line) is
  // the closest equivalent to their major-only pins.
  const container: StartedTestContainer = await new GenericContainer(
    'axllent/mailpit:v1.30',
  )
    .withExposedPorts(1025, 8025)
    .start();

  const host = container.getHost();
  const apiBase = `http://${host}:${container.getMappedPort(8025)}/api/v1`;

  return {
    host,
    smtpPort: container.getMappedPort(1025),

    async messages() {
      const summary = (await (
        await fetch(`${apiBase}/messages`)
      ).json()) as MailpitSummary;

      // Mailpit returns newest first; the contract asserts on send order.
      return Promise.all(
        [...summary.messages].reverse().map(async (message) => {
          const full = (await (
            await fetch(`${apiBase}/message/${message.ID}`)
          ).json()) as MailpitMessage;

          return {
            to: message.To[0]?.Address ?? '',
            subject: message.Subject,
            body: full.Text,
          };
        }),
      );
    },

    async clear() {
      await fetch(`${apiBase}/messages`, { method: 'DELETE' });
    },

    async stop() {
      await container.stop();
    },
  };
}
