import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  DomainErrorKind,
  DomainException,
} from '../../domain/domain-exception.base';

// Total over DomainErrorKind, so adding a kind is a compile error here rather
// than an unmapped status at runtime.
const STATUS_BY_KIND: Record<DomainErrorKind, HttpStatus> = {
  invariant: HttpStatus.UNPROCESSABLE_ENTITY,
  'malformed-identifier': HttpStatus.BAD_REQUEST,
  // A state machine refusing a move: the request was well formed, the
  // aggregate is simply not in a state that allows it.
  'illegal-transition': HttpStatus.CONFLICT,
};

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    const status = STATUS_BY_KIND[exception.kind];

    host.switchToHttp().getResponse<Response>().status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }
}
