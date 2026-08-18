import type { ProductInput } from '@/product/domain';

/**
 * Carries the six fields as one object rather than positionally: five of seven
 * positional parameters would be strings, three of them adjacent, so a
 * transposed call would compile silently, which is the same reason
 * `Product.create` takes an object.
 *
 * `ProductInput` is the domain's own input contract, reused so the field shape
 * exists in one place. Every member is a primitive, so no domain type crosses a
 * layer boundary and presentation constructs an object literal without
 * importing the type.
 */
export class UpdateProductCommand {
  constructor(
    public readonly productId: string,
    public readonly fields: ProductInput,
  ) {}
}
