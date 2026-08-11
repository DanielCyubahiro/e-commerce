import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ApplicationExceptionFilter } from './shared/presentation/filters/application-exception.filter';
import { DomainExceptionFilter } from './shared/presentation/filters/domain-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(
    new ApplicationExceptionFilter(),
    new DomainExceptionFilter(),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
