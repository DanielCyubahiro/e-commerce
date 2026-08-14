import { UniqueId } from '@/shared/domain';

export class ProductId extends UniqueId<'ProductId'> {
  static create(value?: string): ProductId {
    return new ProductId(this.parse(value));
  }
}
