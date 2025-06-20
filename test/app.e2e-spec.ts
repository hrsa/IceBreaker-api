import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { App } from "supertest/types";
import { migrateAndSeed } from "./helpers/database.helper";
import { getTestApp } from "./config/setup";

describe("AppController (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await getTestApp();
    await migrateAndSeed(app);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it("/ (GET)", async () => {
    return request(app.getHttpServer()).get("/").expect(200).expect("Welcome to IceMelter API!");
  });
});
