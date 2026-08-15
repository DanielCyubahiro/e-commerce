import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApplicationErrorKind,
  ApplicationException,
} from '../../application/application-exception.base';

const STATUS_BY_KIND: Record<ApplicationErrorKind, HttpStatus> = {
  conflict: HttpStatus.CONFLICT,
  'not-found': HttpStatus.NOT_FOUND,
};

/**
 * Emits 409 for `conflict` and 404 for `not-found`. `code` here is
 * `exception.code`, stable per `ApplicationErrorKind` and safe for a client to
 * branch on, but only for responses this filter emits: a `ValidationPipe`
 * rejection passes through `UnhandledExceptionFilter` instead, with Nest's own
 * body and no `code` field. See "Error path" in docs/architecture.md.
 */
@Catch(ApplicationException)
export class ApplicationExceptionFilter implements ExceptionFilter {
  catch(exception: ApplicationException, host: ArgumentsHost): void {
    const status = STATUS_BY_KIND[exception.kind];

    host.switchToHttp().getResponse<Response>().status(status).json({
      statusCode: status,
      code: exception.code,
      message: exception.message,
    });
  }
}
