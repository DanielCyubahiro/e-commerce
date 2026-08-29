import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { configureApp } from '@/app.config';
import { AppModule } from '@/app.module';
import {
  AUTH_WEB_SETTINGS,
  type AuthWebSettings,
} from '@/identity/presentation/auth-web-settings';

/**
 * `enableShutdownHooks` is what lets the database providers close their pools
 * on SIGTERM; without it a redeploy leaves connections open until the server
 * times them out.
 *
 * `getOrThrow` rather than `get`, so a PORT that survived env validation but
 * arrived undefined fails loudly here instead of binding a random port.
 *
 * CORS takes its origin from the same `AUTH_WEB_SETTINGS` the guard and the
 * cookie use, so the Origin check and CORS can never name two different
 * origins.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const web = app.get<AuthWebSettings>(AUTH_WEB_SETTINGS);
  configureApp(app, { allowedOrigin: web.allowedOrigin });
  app.enableShutdownHooks();
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}

void bootstrap();
