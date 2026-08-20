import { RecordingEmailSender } from '@test/fakes/recording-email.sender';
import { emailSenderContract } from './email-sender.contract';

const sender = new RecordingEmailSender();

emailSenderContract('recording fake', () =>
  Promise.resolve({
    sender,
    sent: () => Promise.resolve(sender.sent()),
    reset: () => {
      sender.clear();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
