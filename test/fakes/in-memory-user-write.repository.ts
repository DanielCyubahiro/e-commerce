import {
  DuplicateEmailException,
  type Registration,
  type UserWriteRepository,
} from '@/identity/application';
import {
  type Email,
  type User,
  type UserId,
  type UserProfile,
  UserRole,
} from '@/identity/domain';

export interface StoredUser {
  id: UserId;
  email: Email;
  role: UserRole;
  profile: UserProfile;
  /** Assigned once, on `register`; stands in for `created_at`. */
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
  private readonly registered: Registration[] = [];
  private writes = 0;

  register(registration: Registration): Promise<void> {
    const emailTaken = [...this.rows.values()].some((stored) =>
      stored.email.equals(registration.user.email),
    );

    if (emailTaken) {
      return Promise.reject(
        new DuplicateEmailException(registration.user.email.value),
      );
    }

    this.writes += 1;
    this.rows.set(registration.user.id.value, {
      id: registration.user.id,
      email: registration.user.email,
      role: registration.user.role,
      profile: registration.user.profile,
      createdSeq: this.writes,
      updatedSeq: this.writes,
    });
    this.registered.push(registration);
    return Promise.resolve();
  }

  /**
   * Test-only seam: inserts a row directly, bypassing the credential and token
   * bundle `register` requires. For specs seeding a user to exercise unrelated
   * behaviour (list, get, update, delete), which would otherwise have to carry
   * a password hash and a verification token they do not test.
   */
  seed(user: User): void {
    this.writes += 1;
    this.rows.set(user.id.value, {
      id: user.id,
      email: user.email,
      role: user.role,
      profile: user.profile,
      createdSeq: this.writes,
      updatedSeq: this.writes,
    });
  }

  /** Test seam: the credential and token bundle each `register` call carried. */
  registrations(): Registration[] {
    return [...this.registered];
  }

  /**
   * Test-only seam standing in for the operator's `UPDATE users SET role`:
   * with registration fixed to `customer`, this is the only way a test can
   * hold a seller.
   */
  promote(id: UserId): void {
    const existing = this.rows.get(id.value);

    if (!existing) {
      throw new Error(`No stored user holds id ${id.value}.`);
    }

    this.rows.set(id.value, { ...existing, role: UserRole.create('seller') });
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
      role: existing.role,
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
    this.registered.length = 0;
    this.writes = 0;
  }
}
