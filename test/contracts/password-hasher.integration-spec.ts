import { Argon2PasswordHasher } from '@/identity/infrastructure';
import { passwordHasherContract } from './password-hasher.contract';

// In the integration project rather than unit despite needing no container:
// argon2 at 19 MiB per call would slow the unit suite noticeably, and the unit
// project is documented as needing no I/O and being fast.
passwordHasherContract('argon2 adapter', () =>
  Promise.resolve({ hasher: new Argon2PasswordHasher() }),
);
