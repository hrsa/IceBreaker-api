import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { AppModule } from "../../src/app.module";
import { INestApplication } from "@nestjs/common";
import { TelegramModule } from "../../src/telegram/telegram.module";
import { MockTelegramModule } from "./mocks/mock-telegram-module";

export async function setupTestApp(): Promise<INestApplication> {
  process.env.NODE_ENV = "test";
  process.env.APP_ENV = "testing";

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ".env.test",
      }),
      AppModule,
    ],
  })
    .overrideModule(TelegramModule)
    .useModule(MockTelegramModule)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return app;
}
