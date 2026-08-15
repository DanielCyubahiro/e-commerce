# 0001. Money is an integer count of minor units

## Status

Accepted.

## Context

Prices need exact arithmetic and exact round-tripping. Binary floating point
cannot represent most decimal fractions: `19.99` is held as
`19.989999999999998`. Amounts drift under arithmetic, and a value read back is
not guaranteed to equal the value written.

## Decision

`Money` holds a whole number of minor units and a three-letter currency. It is
constructed only through `fromMinorUnits` or `fromDecimal`, both of which
validate and normalise. `fromDecimal` rejects an amount carrying more precision
than the currency has rather than rounding it away. Precision is counted before
multiplying, because `Math.round` is only reliable once the input is known to
fit: `Math.round(4.475 * 100)` is `447`, not `448`.

The column is `integer('price_amount')`, and read models expose
`priceMinorUnits`. Conversion to a decimal happens in presentation.

## Alternatives considered

- **A decimal library.** Exact, but adds a dependency and a wrapper type that
  every layer would have to understand, for a domain where integer minor units
  are already the standard representation.
- **Postgres `numeric`.** Exact in the database, but the driver hands back a
  string, so the conversion problem reappears at the boundary.
- **Floating point with rounding at the edges.** Rejected: the drift is silent,
  and the point of failure is far from the cause.

## Consequences

- Arithmetic is exact and storage round-trips exactly.
- The minor-unit exponent is hardcoded to 2. That is correct for EUR and USD and
  wrong for JPY, which has 0, and KWD, which has 3. Supporting them means
  making the exponent a property of the currency.
- Callers must not confuse the two factories. `fromMinorUnits(1999, 'EUR')` and
  `fromDecimal(19.99, 'EUR')` are the same value, and passing a decimal to the
  former understates it 100-fold while still succeeding.
- Exponential notation is treated as unrepresentable rather than parsed, since it
  only appears at magnitudes no 2-decimal amount reaches.
