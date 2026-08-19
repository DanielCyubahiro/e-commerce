import { Argon2PasswordHasher } from '@/identity/infrastructure';
import { Password } from '@/identity/domain';
import { passwordHasherContract } from './password-hasher.contract';

// In the integration project rather than unit despite needing no container:
// argon2 at 19 MiB per call would slow the unit suite noticeably, and the unit
// project is documented as needing no I/O and being fast.
passwordHasherContract('argon2 adapter', () =>
  Promise.resolve({ hasher: new Argon2PasswordHasher() }),
);

// Outside the shared contract, since the fake has no parameters to pin: this
// covers OPTIONS and DUMMY_HASH in argon2-password.hasher.ts staying in step,
// which today rests on a comment telling whoever changes OPTIONS to
// regenerate the constant by hand.
describe('Argon2PasswordHasher, DUMMY_HASH cost', () => {
  // Everything before the salt: algorithm, version, and the memory/time/
  // parallelism parameters. The salt and digest that follow are unique per
  // call, which is what lets DUMMY_HASH differ from a real hash everywhere
  // else while still costing the same to verify.
  const parameterPrefix = (encoded: string): string =>
    encoded.split('$').slice(0, 4).join('$');

  it('hashes DUMMY_HASH at the same cost as a freshly hashed password', async () => {
    const hasher = new Argon2PasswordHasher();
    const real = await hasher.hash(Password.create('correct horse battery'));

    // Derived from a real hash rather than hardcoded, so a change to OPTIONS
    // fails this test instead of silently outrunning DUMMY_HASH.
    expect(parameterPrefix(hasher.dummyHash().value)).toBe(
      parameterPrefix(real.value),
    );
  });
});
