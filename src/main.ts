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
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.setGlobalPrefix('api/v1');

  const port = config.get<number>('app.port') ?? 3001;
  await app.listen(port);
  logger.log(`Application running on: http://localhost:${port}/api/v1`);
}

void bootstrap();
