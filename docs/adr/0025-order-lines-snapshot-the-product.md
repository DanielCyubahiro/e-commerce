# 0025. Order lines snapshot the product; cross-context references carry no foreign key

## Status

Accepted. Revisits [0007](0007-hard-delete-over-soft-delete.md), which said
it must be revisited when orders reference products, and keeps it.

## Context

An order refers to products and to a customer, both owned by other contexts.
0007 anticipated that deleting a product an order points at would break
referential integrity. That is true of a live reference and false of a copy.

## Decision

`order_lines` carries `product_id` as a plain uuid plus its own `sku`,
`name`, `unit_price_amount`, and `line_total_amount`, copied by
`StockAllocator.allocate` in the same statement that decrements stock.
`orders.customer_id` is likewise a plain uuid. Neither has a foreign key.
Deleting a product leaves every order that sold it intact; deleting a user
leaves their orders intact, addressed to the recipient in the snapshot
address. `StockAllocator.release` skips a product nothing holds. Hard delete
stands.

## Alternatives considered

- **A foreign key with `ON DELETE RESTRICT`.** Rejected: catalogue could never
  remove anything that has sold, and identity could never delete an account
  with a history.
- **Soft delete on products.** Rejected: the every-read filter tax 0007
  already declined, for a problem the snapshot solves.
- **A live reference to the product's current name and price.** Rejected: a
  later price edit must not change a placed order's total, and a renamed
  product must still appear under the name it was sold as.

## Consequences

- An order records what was sold at the price it was sold for; catalogue and
  identity may change freely.
- The personal data in a snapshot address outlives the account (tax
  retention); anonymisation is a job to add later if ever required.
- Nothing prevents a product id on a line from pointing at nothing. Reads
  never join to `products`, so nothing notices.
