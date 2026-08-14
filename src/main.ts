import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { configureApp } from '@/app.config';
import { AppModule } from '@/app.module';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create(AppModule));
  app.enableShutdownHooks();
  await app.listen(app.get(ConfigService).getOrThrow<number>('PORT'));
}

void bootstrap();
