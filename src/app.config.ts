import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ApplicationExceptionFilter } from '@/shared/presentation/filters/application-exception.filter';
import { DomainExceptionFilter } from '@/shared/presentation/filters/domain-exception.filter';
import { UnhandledExceptionFilter } from '@/shared/presentation/filters/unhandled-exception.filter';

/**
 * Applies the request pipeline, and returns the same instance for chaining.
 *
 * Production bootstrap and the HTTP test suites both call this, which is the
 * point: registering a pipe or filter anywhere else lets the two drift, and a
 * test then proves something about a pipeline production does not run.
 *
 * Process-level concerns stay out. `enableShutdownHooks` belongs to `main.ts`,
 * since tests close their app explicitly and would otherwise accumulate a signal
 * listener per instance.
 */
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
