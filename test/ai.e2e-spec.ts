import { App } from "supertest/types";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { migrateAndSeed } from "./helpers/database.helper";
import { TestAppModule } from "./config/test-app.module";
import { TestClientHelper } from "./helpers/test-client.helper";
import { testUsers } from "./seeders/test-data.seeder";
import { AIService } from "../src/ai/ai.service";

describe("AI API (e2e)", () => {
  let app: INestApplication<App>;
  let api: App;
  let client: TestClientHelper;

  const admin = testUsers.admin;
  const user = testUsers.user;

  beforeAll(async () => {
    // Dedicated app with AIService mocked: the real service calls the
    // OpenAI API, which must not happen from tests.
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(AIService)
      .useValue({
        createCustomGame: (description: string, userId: string) => ({
          requestId: "3f2504e0-4f89-11d3-9a0c-0305e82c3301",
          status: "processing",
          message: "Game generation started. Check status in half a minute.",
          echo: { description, userId },
        }),
        translateText: (text: string) => `translated: ${text}`,
        getGreeting: () => "Hello",
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    await app.init();
    api = app.getHttpServer();
    client = new TestClientHelper(api);
    await migrateAndSeed(app);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe("authentication and authorization", () => {
    it("requires authentication for translate/cards", async () => {
      client.clearToken();
      await client.get("/ai/translate/cards").expect(401);
    });

    it("requires authentication for translate/categories", async () => {
      client.clearToken();
      await client.get("/ai/translate/categories").expect(401);
    });

    it("requires authentication for create-game", async () => {
      client.clearToken();
      await client.post("/ai/create-game").send({ description: "d" }).expect(401);
    });

    it("rejects non-admin users from translate/cards with 403", async () => {
      await client.actingAs(user);
      await client.get("/ai/translate/cards").expect(403);
    });

    it("rejects non-admin users from translate/categories with 403", async () => {
      await client.actingAs(user);
      await client.get("/ai/translate/categories").expect(403);
    });

    it("rejects non-admin users from create-game with 403", async () => {
      await client.actingAs(user);
      await client.post("/ai/create-game").send({ description: "d" }).expect(403);
    });
  });

  describe("GET /ai/translate/cards (admin)", () => {
    it("reports zero processed cards when none are missing translations", async () => {
      await client.actingAs(admin);
      const response = await client.get("/ai/translate/cards?limit=10").expect(200);

      // The seeded database has no cards, so nothing to translate and no
      // OpenAI calls are made.
      expect(response.body.processed).toBe(0);
      expect(response.body.updated).toEqual([]);
    });
  });

  describe("GET /ai/translate/categories (admin)", () => {
    it("reports zero processed categories when none are missing translations", async () => {
      await client.actingAs(admin);
      const response = await client.get("/ai/translate/categories?limit=10").expect(200);

      // Seeder categories are created with all languages filled in.
      expect(response.body.processed).toBe(0);
      expect(response.body.updated).toEqual([]);
    });
  });

  describe("POST /ai/create-game (admin)", () => {
    it("starts game generation and returns a processing request", async () => {
      await client.actingAs(admin);
      const me = await client.get("/users/me").expect(200);

      const response = await client.post("/ai/create-game").send({ description: "A game about space travel" }).expect(201);

      expect(response.body.requestId).toBeDefined();
      expect(response.body.status).toBe("processing");
      expect(response.body.message).toContain("Game generation started");
      // The service receives the description and the requesting user
      expect(response.body.echo.description).toBe("A game about space travel");
      expect(response.body.echo.userId).toBe(me.body.id);
    });
  });
});
