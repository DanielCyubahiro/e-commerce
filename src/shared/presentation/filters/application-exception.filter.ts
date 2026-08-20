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
  unauthorized: HttpStatus.UNAUTHORIZED,
  // Authentication succeeded and the account is still not allowed to proceed,
  // which is what an unverified email is. Distinct from 401 so a client can tell
  // "log in again" from "do something about your account".
  forbidden: HttpStatus.FORBIDDEN,
};

/**
 * Emits 409 for `conflict`, 404 for `not-found`, 401 for `unauthorized`, and
 * 403 for `forbidden`. `code` here is `exception.code`, stable per
 * `ApplicationErrorKind` and safe for a client to branch on, but only for
 * responses this filter emits: a `ValidationPipe` rejection passes through
 * `UnhandledExceptionFilter` instead, with Nest's own body and no `code`
 * field. See "Error path" in docs/architecture.md.
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
