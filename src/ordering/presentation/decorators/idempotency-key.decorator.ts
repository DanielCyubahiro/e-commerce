import {
  BadRequestException,
  createParamDecorator,
  type ExecutionContext,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { Request } from 'express';

export const IDEMPOTENCY_KEY_HEADER = 'idempotency-key';

/**
 * Factored out of `createParamDecorator`'s callback so it can be unit-tested.
 * A decorator rather than a header DTO because Nest maps `@Headers()` to the
 * `custom` param type, which the global `ValidationPipe` skips.
 *
 * @returns the key lowercased, or `null` when the header is absent
 * @throws BadRequestException (400, Nest's own body) when present but not a UUID
 */
export function extractIdempotencyKey(
  context: ExecutionContext,
): string | null {
  const raw = context.switchToHttp().getRequest<Request>().headers[
    IDEMPOTENCY_KEY_HEADER
  ];

  if (raw === undefined) {
    return null;
  }

  const value = Array.isArray(raw) ? raw[0] : raw;

  if (value === undefined || !isUUID(value)) {
    throw new BadRequestException(
      `${IDEMPOTENCY_KEY_HEADER} must be a UUID when present.`,
    );
  }

  return value.toLowerCase();
}

export const IdempotencyKey = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string | null =>
    extractIdempotencyKey(context),
);
