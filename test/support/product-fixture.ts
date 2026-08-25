import { Product } from '@/catalogue/domain';

/**
 * The one place a `PlaceOrderHandler`/`CancelOrderHandler` spec may reach a
 * real `Product`: the cross-context lint rule confines
 * `src/ordering/application` to `@/catalogue/application`, so building a
 * fixture to seed `InMemoryProductWriteRepository` has to happen here, under
 * `test/`, where that rule does not apply.
 */
export { Product };
