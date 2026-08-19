import { FakePasswordHasher } from '@test/fakes/fake-password.hasher';
import { passwordHasherContract } from './password-hasher.contract';

passwordHasherContract('fake hasher', () =>
  Promise.resolve({ hasher: new FakePasswordHasher() }),
);
