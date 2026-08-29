import { OrderNotFoundException } from './order-not-found.exception';

describe('OrderNotFoundException', () => {
  it('carries the code, kind, and the id it was given', () => {
    const error = new OrderNotFoundException('order-1');

    expect(error.code).toBe('ORDER_NOT_FOUND');
    expect(error.kind).toBe('not-found');
    expect(error.orderId).toBe('order-1');
  });

  it('names the id in the message', () => {
    expect(new OrderNotFoundException('order-1').message).toMatch(/order-1/);
  });
});
