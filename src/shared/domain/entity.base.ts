import type { UniqueId } from './value-objects/unique-id.vo';

export abstract class Entity<TId extends UniqueId = UniqueId> {
  protected constructor(protected readonly _id: TId) {}

  get id(): TId {
    return this._id;
  }

  /**
   * Compares the constructor as well as the id, so a Product and an Order that
   * happen to share a UUID are not equal. Ids are branded at compile time; this
   * covers values that reached here untyped.
   */
  equals(other: unknown): boolean {
    if (!(other instanceof Entity)) {
      return false;
    }

    return this.constructor === other.constructor && this._id.equals(other._id);
  }
}
