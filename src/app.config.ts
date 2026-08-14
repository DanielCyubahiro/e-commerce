import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ApplicationExceptionFilter } from '@/shared/presentation/filters/application-exception.filter';
import { DomainExceptionFilter } from '@/shared/presentation/filters/domain-exception.filter';
import { UnhandledExceptionFilter } from '@/shared/presentation/filters/unhandled-exception.filter';

export function configureApp<T extends INestApplication>(app: T): T {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(
    new UnhandledExceptionFilter(),
    new ApplicationExceptionFilter(),
    new DomainExceptionFilter(),
  );

  return app;
}
