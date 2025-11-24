import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ensureGaCredsFile } from './utils/ga4-credentials';

ensureGaCredsFile();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const frontendEnv = process.env.FRONTEND_URL;
  const allowedOrigins = frontendEnv
    ? frontendEnv.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000'];
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = process.env.PORT || 3001;
  await app.listen(port);
}
void bootstrap();
