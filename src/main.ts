import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { configureApp } from '@/app.config';
import { AppModule } from '@/app.module';

/**
 * `enableShutdownHooks` is what lets the database providers close their pools
 * on SIGTERM; without it a redeploy leaves connections open until the server
 * times them out.
 *
 * `getOrThrow` rather than `get`, so a PORT that survived env validation but
 * arrived undefined fails loudly here instead of binding a random port.
 */
async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}

void bootstrap();
