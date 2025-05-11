import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ValidationPipe } from "@nestjs/common";
import { getBotToken } from "nestjs-telegraf";
import { join } from 'path';
import { NestExpressApplication } from '@nestjs/platform-express';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );
  app.useStaticAssets(join(__dirname, "..", "assets"), {
    prefix: "/assets/",
  });

  app.enableCors();
  const bot = app.get(getBotToken());
  app.use(bot.webhookCallback(process.env.TELEGRAM_BOT_HOOK_PATH, "/tg-webhook"));

  const config = new DocumentBuilder()
    .setTitle("IceMelter API")
    .setDescription("IceMelter helps you spark meaningful conversations with anyone!")
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api", app, document);

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();
