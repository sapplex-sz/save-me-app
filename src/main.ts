import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BasicAuthMiddleware } from './basic-auth.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // 全局拦截 /admin 路径，确保 Bull Board 也能被保护
  app.use('/admin', new BasicAuthMiddleware().use);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
