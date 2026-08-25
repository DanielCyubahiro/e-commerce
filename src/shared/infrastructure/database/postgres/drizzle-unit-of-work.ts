import { AsyncLocalStorage } from 'node:async_hooks';
import { Inject, Injectable } from '@nestjs/common';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { PostgresJsQueryResultHKT } from 'drizzle-orm/postgres-js';
import type { Transaction, UnitOfWork } from '@/shared/application';
import { DRIZZLE, type DrizzleDB } from './drizzle.provider';
import type * as schema from './schema';

/**
 * The common supertype of the database handle and a transaction on it, so an
 * adapter holds one variable whether or not a `tx` was passed. Calling
 * `.transaction()` on a value that is already a transaction opens a savepoint.
 */
export type DrizzleExecutor = PgDatabase<
  PostgresJsQueryResultHKT,
  typeof schema
>;

/**
 * The only place the opaque `Transaction` is unwrapped. Every Drizzle adapter
 * that participates in a unit of work calls this and nothing else.
 */
export function asDrizzleTransaction(tx: Transaction): DrizzleExecutor {
  return tx as unknown as DrizzleExecutor;
}

@Injectable()
export class DrizzleUnitOfWork implements UnitOfWork {
  private readonly depth = new AsyncLocalStorage<true>();

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Rejects nesting rather than opening a second transaction: Drizzle would
   * hand the inner `work` a savepoint on the outer connection, and a throw
   * inside it would then roll back less than the caller believes.
   */
  run<T>(work: (tx: Transaction) => Promise<T>): Promise<T> {
    if (this.depth.getStore()) {
      return Promise.reject(new Error('UnitOfWork.run cannot be nested.'));
    }

    return this.depth.run(true, () =>
      this.db.transaction((tx) => work(tx as unknown as Transaction)),
    );
  }
}
