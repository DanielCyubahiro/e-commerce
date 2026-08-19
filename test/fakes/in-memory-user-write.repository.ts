import {
  DuplicateEmailException,
  type UserWriteRepository,
} from '@/identity/application';
import type { User, UserId } from '@/identity/domain';

export interface StoredUser {
  user: User;
  /** Assigned once, on `add`; stands in for `created_at`. */
  createdSeq: number;
  /** Bumped by every write to this row; stands in for `updated_at`. */
  updatedSeq: number;
}

/**
 * A fake rather than a mock: it asserts what actually happened rather than how
 * a collaborator was called. Its fidelity is not taken on trust, the shared
 * contract suite runs against both this and the Drizzle adapter.
 *
 * Methods return promises without being `async` so they reject rather than
 * throw synchronously, which callers awaiting them depend on.
 */
export class InMemoryUserWriteRepository implements UserWriteRepository {
  private readonly rows = new Map<string, StoredUser>();
  private writes = 0;

  add(user: User): Promise<void> {
    const emailTaken = [...this.rows.values()].some((stored) =>
      stored.user.email.equals(user.email),
    );

    if (emailTaken) {
      return Promise.reject(new DuplicateEmailException(user.email.value));
    }

    this.writes += 1;
    this.rows.set(user.id.value, {
      user,
      createdSeq: this.writes,
      updatedSeq: this.writes,
    });
    return Promise.resolve();
  }

  replace(user: User): Promise<boolean> {
    const existing = this.rows.get(user.id.value);

    if (!existing) {
      return Promise.resolve(false);
    }

    const emailTaken = [...this.rows.values()].some(
      (stored) =>
        stored.user.email.equals(user.email) && !stored.user.id.equals(user.id),
    );

    if (emailTaken) {
      return Promise.reject(new DuplicateEmailException(user.email.value));
    }

    this.writes += 1;
    // `createdSeq` is carried over so the row keeps its place in created_at
    // order exactly as the adapter's row does.
    this.rows.set(user.id.value, {
      user,
      createdSeq: existing.createdSeq,
      updatedSeq: this.writes,
    });
    return Promise.resolve(true);
  }

  delete(id: UserId): Promise<boolean> {
    return Promise.resolve(this.rows.delete(id.value));
  }

  snapshot(): User[] {
    return [...this.rows.values()].map((stored) => stored.user);
  }

  stored(): StoredUser[] {
    return [...this.rows.values()];
  }

  clear(): void {
    this.rows.clear();
    this.writes = 0;
  }
}
