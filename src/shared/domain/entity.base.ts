import type { UniqueId } from './value-objects/unique-id.vo';

export abstract class Entity<TId extends UniqueId = UniqueId> {
  protected constructor(protected readonly _id: TId) {}

  get id(): TId {
    return this._id;
  }

  equals(other: unknown): boolean {
    if (!(other instanceof Entity)) {
      return false;
    }

    return this.constructor === other.constructor && this._id.equals(other._id);
  }
}
