# Ordering

The ordering context: placing an order against the catalogue, moving it
through its lifecycle, and reading it back. Layer rules, the error mechanism,
and the generic fork procedure live in
[`docs/architecture.md`](../architecture.md); this file carries only what is
specific to `src/ordering/`.

## What it owns

[`Order`](../../src/ordering/domain/entities/order.entity.ts) is the aggregate
and the whole consistency boundary.
[`Order.place`](../../src/ordering/domain/entities/order.entity.ts) is the only
way one comes into being: 1 to 100 lines, no product twice, every line in one
currency, and the four totals computed once (`subtotal` as the sum of line
totals, `shippingFee` and `tax` at zero until a pricing rule exists, `total`
as their sum).
[`Order.reconstitute`](../../src/ordering/domain/entities/order.entity.ts) is
the persistence factory, taking value objects rather than primitives so each
value's own rule re-runs on the way back in. Four behaviours,
[`Order.pay`](../../src/ordering/domain/entities/order.entity.ts), `ship`,
`deliver`, and `cancel`, each move the status through
`OrderStatus.transitionTo` and stamp their own timestamp, so an illegal move
throws before any state changes. `version` is carried, never changed: the
repository's guarded `save` owns it.

The value objects an order is made of, each owning its own rule:

- Quantity: [`Quantity.create`](../../src/ordering/domain/value-objects/quantity.vo.ts)
  accepts an integer from 1 to 999. It is the one rule that must hold before
  stock is touched, since `stock - qty` with a negative `qty` adds stock.
- Status: [`OrderStatus.create`](../../src/ordering/domain/value-objects/order-status.vo.ts)
  accepts `placed`, `paid`, `shipped`, `delivered`, or `cancelled`, and
  [`OrderStatus.transitionTo`](../../src/ordering/domain/value-objects/order-status.vo.ts)
  owns the whole state machine: `placed` may become `paid` or `cancelled`,
  `paid` may become `shipped` or `cancelled`, `shipped` may become
  `delivered`, and the last two are terminal.
- Shipping address: [`ShippingAddress.create`](../../src/ordering/domain/value-objects/shipping-address.vo.ts)
  trims every field, bounds lengths (200 for the recipient and both lines,
  100 for city and region, 20 for the postal code), uppercases the country and
  requires exactly two letters. `line2` and `region` are optional; absent
  means `null`. No per-country postal code formats, deliberately.
- Line request: [`OrderLineRequest.create`](../../src/ordering/domain/value-objects/order-line-request.vo.ts)
  pairs a [`ProductRef`](../../src/ordering/domain/value-objects/product-ref.vo.ts)
  with a `Quantity`, and is what a customer asks for before the catalogue has
  said anything.
- Line: [`OrderLine.create`](../../src/ordering/domain/value-objects/order-line.vo.ts)
  is one product as it was sold, `sku` and `name` copied at allocation, unit
  price and line total as [`Money`](../../src/shared/domain/value-objects/money.vo.ts).
  A value object, not an entity: one product may appear on an order once.
- Identifiers: [`OrderId`](../../src/ordering/domain/value-objects/order-id.vo.ts),
  [`CustomerId`](../../src/ordering/domain/value-objects/customer-id.vo.ts)
  (ordering's own name for identity's user), and `ProductRef` (a reference
  into catalogue that need not resolve).

## Endpoints

none

## Ports and adapters

Ports are declared in
[`src/ordering/application/ports/`](../../src/ordering/application/ports/).

| Token | Interface | Adapter |
| --- | --- | --- |
| [`ORDER_WRITE_REPOSITORY`](../../src/ordering/application/ports/order.write-repository.ts) | `OrderWriteRepository` | [`DrizzleOrderWriteRepository`](../../src/ordering/infrastructure/adapters/drizzle-order.write-repository.ts) |
| [`ORDER_READ_REPOSITORY`](../../src/ordering/application/ports/order.read-repository.ts) | `OrderReadRepository` | [`DrizzleOrderReadRepository`](../../src/ordering/infrastructure/adapters/drizzle-order.read-repository.ts) |

| Contract | Fake binding, `unit` | Adapter binding, `integration` |
| --- | --- | --- |
| [`orderWriteRepositoryContract`](../../test/contracts/order-write-repository.contract.ts) | [`order-write-repository.spec.ts`](../../test/contracts/order-write-repository.spec.ts) | [`order-write-repository.integration-spec.ts`](../../test/contracts/order-write-repository.integration-spec.ts) |
| [`orderReadRepositoryContract`](../../test/contracts/order-read-repository.contract.ts) | [`order-read-repository.spec.ts`](../../test/contracts/order-read-repository.spec.ts) | [`order-read-repository.integration-spec.ts`](../../test/contracts/order-read-repository.integration-spec.ts) |

Failure modes a fake cannot reproduce, the trigger moving `updated_at` and the
identity column assigning `number`, are covered in
[`drizzle-order-write.integration-spec.ts`](../../test/contracts/drizzle-order-write.integration-spec.ts).

## Request lifecycle

none

## Error codes

Codes raised by `src/ordering/`. Shared kernel codes, `MONEY_INVALID` and
`IDENTIFIER_INVALID`, reach these paths too and are documented with the error
mechanism in [`docs/architecture.md`](../architecture.md#error-path).

| Code | Kind | Status | Raised by |
| --- | --- | --- | --- |
| `ORDER_LINES_INVALID` | `invariant` | 422 | [`InvalidOrderLinesException`](../../src/ordering/domain/exceptions/invalid-order-lines.exception.ts) |
| `ORDER_QUANTITY_INVALID` | `invariant` | 422 | [`Quantity`](../../src/ordering/domain/value-objects/quantity.vo.ts) |
| `ORDER_SHIPPING_ADDRESS_INVALID` | `invariant` | 422 | [`ShippingAddress`](../../src/ordering/domain/value-objects/shipping-address.vo.ts) |
| `ORDER_STATUS_INVALID` | `invariant` | 422 | [`OrderStatus.create`](../../src/ordering/domain/value-objects/order-status.vo.ts) |
| `ORDER_TRANSITION_ILLEGAL` | `illegal-transition` | 409 | [`OrderStatus.transitionTo`](../../src/ordering/domain/value-objects/order-status.vo.ts) |
| `ORDER_NOT_FOUND` | `not-found` | 404 | [`OrderNotFoundException`](../../src/ordering/application/exceptions/order-not-found.exception.ts) |
| `ORDER_STOCK_UNAVAILABLE` | `conflict` | 409 | [`StockUnavailableException`](../../src/ordering/application/exceptions/stock-unavailable.exception.ts), body carries `details` |
| `ORDER_CONFLICT` | `conflict` | 409 | [`OrderConflictException`](../../src/ordering/application/exceptions/order-conflict.exception.ts) |

## Fork notes

Four couplings fail silently rather than loudly.

- The unique index `orders_customer_id_idempotency_key_unique` in
  [`orders.schema.ts`](../../src/shared/infrastructure/database/postgres/schema/orders.schema.ts):
  [`DrizzleOrderWriteRepository`](../../src/ordering/infrastructure/adapters/drizzle-order.write-repository.ts)
  matches that exact name on a `23505` to report `'duplicate-key'`. A fork
  whose schema tool names it anything else still rejects the replay at the
  database, but the client gets a 500 where it should get the original 201.
- `orders_set_updated_at` in `drizzle/0009_orders_updated_at_trigger.sql`
  owns `updated_at`; a fork that drops the trigger leaves it frozen at insert
  time with no error anywhere (ADR 0009).
- `number` is `GENERATED ALWAYS AS IDENTITY`; the adapter never writes it. A
  fork whose schema tool does not emit identity columns needs a sequence and
  a default, or every insert fails on the not-null constraint.
- `order_lines_quantity_positive` and catalogue's `products_stock_non_negative`
  are backstops behind domain rules; dropping them keeps correctness for
  writers that go through the ports and loses it for any that do not.
