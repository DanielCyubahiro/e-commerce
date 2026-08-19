import {
  DuplicateEmailException,
  type UserWriteRepository,
} from '@/identity/application';
import type { Email, User, UserId, UserProfile } from '@/identity/domain';

export interface StoredUser {
  id: UserId;
  email: Email;
  profile: UserProfile;
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
 * Stores decomposed rows rather than a `User`: with `User.replace` gone there
 * is no way to build a `User` carrying an existing id, and reconstructing one
 * here would reintroduce exactly what removing `replace` was for. A
 * repository row is not an aggregate.
 *
 * Methods return promises without being `async` so they reject rather than
 * throw synchronously, which callers awaiting them depend on.
 */
export class InMemoryUserWriteRepository implements UserWriteRepository {
  private readonly rows = new Map<string, StoredUser>();
  private writes = 0;

  add(user: User): Promise<void> {
    const emailTaken = [...this.rows.values()].some((stored) =>
      stored.email.equals(user.email),
    );

    if (emailTaken) {
      return Promise.reject(new DuplicateEmailException(user.email.value));
    }

    this.writes += 1;
    this.rows.set(user.id.value, {
      id: user.id,
      email: user.email,
      profile: user.profile,
      createdSeq: this.writes,
      updatedSeq: this.writes,
    });
    return Promise.resolve();
  }

  replaceProfile(id: UserId, profile: UserProfile): Promise<boolean> {
    const existing = this.rows.get(id.value);

    if (!existing) {
      return Promise.resolve(false);
    }

    this.writes += 1;
    this.rows.set(id.value, {
      id: existing.id,
      email: existing.email,
      profile,
      // `createdSeq` is carried over so the row keeps its place in created_at
      // order exactly as the adapter's row does.
      createdSeq: existing.createdSeq,
      updatedSeq: this.writes,
    });
    return Promise.resolve(true);
  }

  delete(id: UserId): Promise<boolean> {
    return Promise.resolve(this.rows.delete(id.value));
  }

  snapshot(): StoredUser[] {
    return [...this.rows.values()];
  }

  clear(): void {
    this.rows.clear();
    this.writes = 0;
  }
}
