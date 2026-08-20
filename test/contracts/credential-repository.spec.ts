import { randomUUID } from 'node:crypto';
import { InMemoryCredentialRepository } from '@test/fakes/in-memory-credential.repository';
import { credentialRepositoryContract } from './credential-repository.contract';

const repository = new InMemoryCredentialRepository();

credentialRepositoryContract('in-memory fake', () =>
  Promise.resolve({
    repository,
    seed: (input) => {
      const userId = randomUUID();
      repository.seed({
        userId,
        email: input.email,
        role: input.role,
        passwordHash: input.passwordHash,
        emailVerifiedAt: input.emailVerifiedAt ?? null,
      });
      return Promise.resolve(userId);
    },
    reset: () => {
      repository.clear();
      return Promise.resolve();
    },
    close: () => Promise.resolve(),
  }),
);
