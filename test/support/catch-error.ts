/**
 * A class referred to by its prototype rather than its constructor.
 *
 * A class with a private constructor is not assignable to any `new (...) => T`
 * signature, so neither Jest's `toThrow` nor a construct-signature parameter can
 * accept one. Describing the class by `prototype` sidesteps that entirely.
 */
export interface ErrorClass<T extends Error> {
  prototype: T;
  name: string;
}

/** Prototype-chain test, which is what `instanceof` does, minus the cast. */
function isInstanceOf<T extends Error>(
  value: unknown,
  type: ErrorClass<T>,
): value is T {
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.prototype.isPrototypeOf.call(type.prototype, value)
  );
}

/**
 * Runs `fn`, asserts it threw an instance of `type`, and returns that error so
 * the caller can assert on its own fields.
 *
 * Prefer this to `expect(fn).toThrow(SomeClass)` for domain exceptions: they have
 * private constructors so they are built through named factories, and `toThrow`
 * cannot accept them. Returning the error is the useful part, since it makes
 * `code` and `kind` assertable rather than only the exception's identity.
 *
 * Throws a plain `Error` on mismatch rather than calling `expect`, so it stays
 * usable outside a test body and keeps `jest/no-standalone-expect` satisfied.
 *
 * @param fn the call expected to throw
 * @param type the expected exception class
 * @returns the thrown error, narrowed to `type`
 */
export function catchError<T extends Error>(
  fn: () => unknown,
  type: ErrorClass<T>,
): T {
  try {
    fn();
  } catch (error) {
    if (isInstanceOf(error, type)) {
      return error;
    }
    throw new Error(
      `Expected ${type.name} to be thrown, but got ${String(error)}.`,
    );
  }

  throw new Error(
    `Expected ${type.name} to be thrown, but nothing was thrown.`,
  );
}

/**
 * The awaited form of `catchError`, for a promise expected to reject.
 *
 * @param fn the call expected to reject
 * @param type the expected exception class
 * @returns the rejection reason, narrowed to `type`
 */
export async function catchRejection<T extends Error>(
  fn: () => Promise<unknown>,
  type: ErrorClass<T>,
): Promise<T> {
  try {
    await fn();
  } catch (error) {
    if (isInstanceOf(error, type)) {
      return error;
    }
    throw new Error(
      `Expected ${type.name} to be rejected with, but got ${String(error)}.`,
    );
  }

  throw new Error(
    `Expected ${type.name} to be rejected with, but the promise resolved.`,
  );
}
