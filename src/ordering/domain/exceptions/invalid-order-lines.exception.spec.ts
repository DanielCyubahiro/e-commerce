import { InvalidOrderLinesException } from './invalid-order-lines.exception';

// Nothing in this task raises InvalidOrderLinesException yet: the rules it
// names (an order needs lines, a ceiling on how many, one product per line,
// one currency throughout) belong to the Order aggregate, arriving next. This
// spec exercises its four factories directly so the domain coverage floor
// holds in the meantime.
describe('InvalidOrderLinesException', () => {
  it('names the code and kind on every factory', () => {
    expect(InvalidOrderLinesException.empty().code).toBe('ORDER_LINES_INVALID');
    expect(InvalidOrderLinesException.empty().kind).toBe('invariant');
  });

  it('reports an order with no lines', () => {
    expect(InvalidOrderLinesException.empty().message).toMatch(
      /at least one line/,
    );
  });

  it('reports an order over the line ceiling', () => {
    expect(InvalidOrderLinesException.tooMany(20).message).toMatch(
      /at most 20 lines/,
    );
  });

  it('reports a product repeated across lines', () => {
    expect(
      InvalidOrderLinesException.duplicateProduct('product-1').message,
    ).toMatch(/product-1.*more than one line/);
  });

  it('reports lines priced in more than one currency', () => {
    expect(
      InvalidOrderLinesException.mixedCurrencies('EUR', 'USD').message,
    ).toMatch(/USD alongside EUR/);
  });
});
