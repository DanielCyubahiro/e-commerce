import { UniqueId } from './value-objects/unique-id.vo';

export abstract class Entity<T extends UniqueId = UniqueId> {
  protected readonly id: T;
  
  constructor(id: T) {
    this.id = id;
  }

  getId(): T {
    return this.id;
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

    return this.id.equals(other.id);
  }
}
