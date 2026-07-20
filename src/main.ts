import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe, Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  app.use(cookieParser(config.get<string>('app.cookieSecret')));

  app.enableCors({
    origin: config.get<string>('app.frontendUrl'),
    credentials: true, // required so browser sends/receives httpOnly cookies
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not defined in DTOs
      forbidNonWhitelisted: true, // throw if extra properties are sent
      transform: true, // auto-transform payloads to DTO instances
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1');

  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);
  logger.log(`Application running on: http://localhost:${port}/api/v1`);
}

void bootstrap();
