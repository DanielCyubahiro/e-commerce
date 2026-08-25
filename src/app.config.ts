import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import cookieParser from 'cookie-parser';
import { ApplicationExceptionFilter } from '@/shared/presentation/filters/application-exception.filter';
import { DomainExceptionFilter } from '@/shared/presentation/filters/domain-exception.filter';
import { UnhandledExceptionFilter } from '@/shared/presentation/filters/unhandled-exception.filter';

/**
 * The one browser-facing value `configureApp` cannot read for itself: it has
 * no `ConfigService`, because the http-specs bootstrap without `ConfigModule`.
 */
export interface AppOptions {
  /** Exact origin CORS allows with credentials: `new URL(WEB_BASE_URL).origin`. */
  allowedOrigin: string;
}

/**
 * The single definition of the request pipeline, applied by `main.ts` in
 * production and by every http-spec (`app-config.http-spec.ts`,
 * `product.http-spec.ts`), so a test exercises the same cookie parsing, CORS,
 * validation and error handling the server does.
 *
 * `whitelist` strips properties no DTO declares, and `forbidNonWhitelisted`
 * turns their presence into a 400 rather than a silent drop.
 *
 * `transform: true` hands the controller an actual DTO instance rather than a
 * plain object. It is not, by itself, what runs the `@Type` coercion or saves
 * the numeric validators: `ValidationPipe.transform` builds the validated
 * entity through `plainToInstance` unconditionally, and with `whitelist` and
 * `forbidNonWhitelisted` set, as they are here, Nest hands that entity back
 * even with this flag off. What the flag changes is the value's shape, not
 * whether validation ran correctly.
 *
 * Filters are ordered general to specific. `ExceptionsHandler` (in
 * `@nestjs/core`) checks global filters in the reverse of their registration
 * order and takes the first exception-type match via
 * `selectExceptionFilterMetadata`, so `DomainExceptionFilter`, registered
 * last, is tried first, and `UnhandledExceptionFilter`, registered first, is
 * tried last. Its bare `@Catch()` matches anything, so it has to be the one
 * checked last, or it would swallow every exception before the typed filters
 * get a turn.
 */
export function configureApp<T extends INestApplication>(
  app: T,
  options: AppOptions,
): T {
  // Populates `request.cookies`, which `SessionCookie.read` relies on.
  app.use(cookieParser());

  // A predicate, not the bare string: the `cors` package sets a fixed-string
  // origin unconditionally, on every request, so a mismatched Origin would
  // still get the header back and only the browser's own check would deny
  // it. Declining here instead omits the header entirely for anyone but
  // `allowedOrigin`, which is what lets a mismatch be asserted on directly
  // rather than trusted to browser behaviour. Credentials rule out a
  // wildcard regardless, so the one origin allowed is also the only one ever
  // echoed back.
  const corsOptions: CorsOptions = {
    origin: (origin, callback) => {
      callback(null, origin === options.allowedOrigin);
    },
    credentials: true,
  };
  app.enableCors(corsOptions);

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
