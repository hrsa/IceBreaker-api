import { Test, TestingModule } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { AppModule } from "../../src/app.module";
import { INestApplication } from "@nestjs/common";
import { MockTelegrafModule } from "./mock-telegraf.module";

export async function setupTestApp(): Promise<INestApplication> {
  process.env.NODE_ENV = "test";

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ".env.test",
      }),
      AppModule,
    ],
  })
    .overrideModule(await import("nestjs-telegraf").then(m => m.TelegrafModule))
    .useModule(MockTelegrafModule)
    .compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return app;
}
