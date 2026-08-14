export interface ErrorClass<T extends Error> {
  prototype: T;
  name: string;
}

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
