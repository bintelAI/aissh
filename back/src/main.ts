import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { Server } from 'node:http';

const backendStartTime = Date.now();

async function bootstrap(): Promise<void> {
  console.log('[Backend] Starting NestJS application...');
  const nestStartTime = Date.now();
  
  const app: INestApplication = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });
  
  const nestTime = Date.now() - nestStartTime;
  console.log(`[Backend] NestJS application created in ${nestTime}ms`);
  
  app.enableCors({
    origin: (origin, callback) => {
      const localOrigins = new Set(['http://localhost:3000', 'http://127.0.0.1:3000']);
      callback(null, !origin || localOrigins.has(origin));
    },
  });

  const port = process.env.PORT ?? 3001;
  const listenStartTime = Date.now();
  
  await app.listen(port, '127.0.0.1');
  
  const listenTime = Date.now() - listenStartTime;
  console.log(`[Backend] Server listening in ${listenTime}ms`);

  const httpServer: Server = app.getHttpServer();
  const address = httpServer.address() as AddressInfo | null;
  const actualPort = address?.port ?? port;

  const totalTime = Date.now() - backendStartTime;
  console.log(`[Backend] Total startup time: ${totalTime}ms`);

  if (process.send) {
    process.send({ type: 'server-port', port: actualPort });
    console.log(`[Backend] Started on port: ${actualPort}`);
  } else {
    console.log(`[Backend] Started on port: ${actualPort}`);
  }
}

void bootstrap();
