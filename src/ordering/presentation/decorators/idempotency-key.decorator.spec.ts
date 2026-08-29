import { BadRequestException, type ExecutionContext } from '@nestjs/common';
import { catchError } from '@test/support/catch-error';
import { extractIdempotencyKey } from './idempotency-key.decorator';

const contextWith = (headers: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

describe('extractIdempotencyKey', () => {
  it('returns null when the header is absent', () => {
    expect(extractIdempotencyKey(contextWith({}))).toBeNull();
  });

  it('returns the key lowercased when it is a UUID', () => {
    expect(
      extractIdempotencyKey(
        contextWith({
          'idempotency-key': '9C858901-8A57-4791-81FE-4C455B099BC9',
        }),
      ),
    ).toBe('9c858901-8a57-4791-81fe-4c455b099bc9');
  });

  it('takes the first value when the header was sent twice', () => {
    expect(
      extractIdempotencyKey(
        contextWith({
          'idempotency-key': [
            '9c858901-8a57-4791-81fe-4c455b099bc9',
            '16fd2706-8baf-433b-82eb-8c7fada847da',
          ],
        }),
      ),
    ).toBe('9c858901-8a57-4791-81fe-4c455b099bc9');
  });

  it.each(['', 'not-a-uuid', ['']])(
    'answers 400 for %p rather than storing it',
    (value) => {
      const error = catchError(
        () => extractIdempotencyKey(contextWith({ 'idempotency-key': value })),
        BadRequestException,
      );

      expect(error.getStatus()).toBe(400);
    },
  );
});
