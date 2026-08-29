import { ORDER_READ_REPOSITORY } from './order.read-repository';
import { ORDER_WRITE_REPOSITORY } from './order.write-repository';

/**
 * Every consumer of these tokens so far imports them with `import type`,
 * since only the Nest module that binds an adapter needs the runtime value,
 * and that binding arrives with the handlers in later tasks. Without this
 * spec nothing loads either module until then, so a mis-described or
 * accidentally shared token would go unnoticed until it wired the wrong
 * adapter at boot.
 */
describe('port tokens', () => {
  it('are distinct symbols', () => {
    expect(ORDER_WRITE_REPOSITORY).not.toBe(ORDER_READ_REPOSITORY);
  });

  it('describe themselves with the name they were declared under', () => {
    expect(typeof ORDER_WRITE_REPOSITORY).toBe('symbol');
    expect(String(ORDER_WRITE_REPOSITORY)).toBe(
      'Symbol(ORDER_WRITE_REPOSITORY)',
    );
    expect(typeof ORDER_READ_REPOSITORY).toBe('symbol');
    expect(String(ORDER_READ_REPOSITORY)).toBe('Symbol(ORDER_READ_REPOSITORY)');
  });
});
