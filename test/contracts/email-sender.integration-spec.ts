import { SmtpEmailSender } from '@/identity/infrastructure';
import { startMailpit } from '@test/setup/mailpit-container';
import { emailSenderContract } from './email-sender.contract';

// Pulling a container image on a cold cache dominates the default 5s hook
// timeout.
jest.setTimeout(120_000);

emailSenderContract('smtp adapter', async () => {
  const mailpit = await startMailpit();

  return {
    sender: new SmtpEmailSender({
      host: mailpit.host,
      port: mailpit.smtpPort,
      from: 'no-reply@example.com',
      webBaseUrl: 'http://localhost:5173',
    }),
    sent: () => mailpit.messages(),
    reset: () => mailpit.clear(),
    close: () => mailpit.stop(),
  };
});
