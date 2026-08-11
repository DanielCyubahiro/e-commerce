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
} from '../../application/base.application-exception';

const STATUS_BY_KIND: Record<ApplicationErrorKind, HttpStatus> = {
  conflict: HttpStatus.CONFLICT,
  'not-found': HttpStatus.NOT_FOUND,
};

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
