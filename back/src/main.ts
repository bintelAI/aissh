import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  const server = await app.listen(process.env.PORT ?? 3001);
  const address = server.address();
  const port = typeof address === 'string' ? address : address?.port;
  
  if (process.send) {
    process.send({ type: 'server-port', port });
    console.log(`Backend started on random port: ${port}`);
  } else {
    console.log(`Backend started on port: ${port}`);
  }
}
bootstrap();
