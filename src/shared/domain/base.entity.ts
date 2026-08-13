import { type UniqueId } from './value-objects/unique-id.vo';

export abstract class Entity<T extends UniqueId = UniqueId> {
  protected readonly _id: T;

  protected constructor(id: T) {
    this._id = id;
  }

  get id(): T {
    return this._id;
  }

  equals(other: Entity<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (this === other) {
      return true;
    }

    if (!(other instanceof Entity)) {
      return false;
    }

    return this._id.equals(other._id);
  }
}
