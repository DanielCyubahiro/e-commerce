export const UNIT_OF_WORK = Symbol('UNIT_OF_WORK');

/**
 * Opaque handle for one transaction. The application layer only passes it
 * along; the one place that knows what it wraps is `asDrizzleTransaction` in
 * shared infrastructure.
 */
export interface Transaction {
  readonly __brand: 'Transaction';
}

/**
 * Runs `work` inside one transaction. A return commits and is returned; a
 * throw rolls back and propagates unchanged. Nesting is rejected with an
 * `Error` rather than silently opening a second, independent transaction.
 *
 * Exists for the two writes that must be atomic across ports (allocating
 * stock and placing an order, and the mirror image on cancel). A single
 * guarded statement needs no unit of work and should not take one.
 */
export interface UnitOfWork {
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T>;
}
