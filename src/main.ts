import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { setupOpenApi } from './openapi';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  setupOpenApi(app);
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
