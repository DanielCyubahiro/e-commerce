import { AggregateRoot as CqrsAggregateRoot } from '@nestjs/cqrs';
import { type UniqueId } from './value-objects/unique-id.vo';

export abstract class AggregateRoot<
  T extends UniqueId = UniqueId,
> extends CqrsAggregateRoot {
  protected readonly _id: T;

  protected constructor(id: T) {
    super();
    this._id = id;
  }

  get id(): T {
    return this._id;
  }

  equals(other: AggregateRoot<T>): boolean {
    if (other === null || other === undefined) {
      return false;
    }

    if (this === other) {
      return true;
    }

    if (!(other instanceof AggregateRoot)) {
      return false;
    }

    return this._id.equals(other._id);
  }
}
