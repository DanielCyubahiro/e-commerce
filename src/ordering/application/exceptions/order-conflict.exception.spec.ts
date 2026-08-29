import { OrderConflictException } from './order-conflict.exception';

describe('OrderConflictException', () => {
  it('carries the code, kind, and the id it was given', () => {
    const error = new OrderConflictException('order-1');

    expect(error.code).toBe('ORDER_CONFLICT');
    expect(error.kind).toBe('conflict');
    expect(error.orderId).toBe('order-1');
  });

  it('tells the client to reload and retry', () => {
    expect(new OrderConflictException('order-1').message).toMatch(
      /reload and retry/,
    );
  });
});
