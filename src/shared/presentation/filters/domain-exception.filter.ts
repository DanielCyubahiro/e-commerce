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
} from '../../domain/base.domain-exception';

const STATUS_BY_KIND: Record<DomainErrorKind, HttpStatus> = {
  invariant: HttpStatus.UNPROCESSABLE_ENTITY,
  'malformed-identifier': HttpStatus.BAD_REQUEST,
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
