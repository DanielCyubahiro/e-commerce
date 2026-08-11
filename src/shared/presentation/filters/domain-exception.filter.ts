import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { DomainException } from '../../domain/base.domain-exception';

const STATUS = HttpStatus.UNPROCESSABLE_ENTITY;

@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost): void {
    host.switchToHttp().getResponse<Response>().status(STATUS).json({
      statusCode: STATUS,
      code: exception.code,
      message: exception.message,
    });
  }
}
