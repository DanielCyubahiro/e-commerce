import { UniqueId } from '../../../shared/domain/value-objects/unique-id.vo';

export class ProductId extends UniqueId {
  static create(value?: string): ProductId {
    return new ProductId(this.parse(value));
  }
}
