# Ordering

The ordering context: placing an order against the catalogue, moving it
through its lifecycle, and reading it back. Layer rules, the error mechanism,
and the generic fork procedure live in
[`docs/architecture.md`](../architecture.md); this file carries only what is
specific to `src/ordering/`.

## What it owns

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

none

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
