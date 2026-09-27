import { App } from "supertest/types";
import { INestApplication } from "@nestjs/common";
import { migrateAndSeed } from "./helpers/database.helper";
import { getTestApp } from "./config/setup";
import { TestClientHelper } from "./helpers/test-client.helper";
import { testUsers } from "./seeders/test-data.seeder";

describe("Suggestions API (e2e)", () => {
  let app: INestApplication<App>;
  let api: App;
  let client: TestClientHelper;

  const admin = testUsers.admin;
  const user = testUsers.user;
  let userId = "";
  let adminId = "";
  let userSuggestionId = "";
  let adminSuggestionId = "";

  beforeAll(async () => {
    app = (await getTestApp()) as INestApplication<App>;
    api = app.getHttpServer();
    client = new TestClientHelper(api);
    await migrateAndSeed(app);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe("POST /suggestions", () => {
    it("creates a suggestion attributed to the current user", async () => {
      await client.actingAs(user);
      const me = await client.get("/users/me").expect(200);
      userId = me.body.id;

      // Note: the POST response DTO (SuggestionResponseDto) does not expose
      // userId or accepted; ownership is verified via GET /suggestions/:id,
      // which returns the raw entity.
      const response = await client
        .post("/suggestions")
        .send({
          // userId in the body is overwritten by the controller with the
          // current user's id, but it must still pass UUID validation.
          userId: "00000000-0000-0000-0000-000000000000",
          question: "What is your favorite childhood memory?",
        })
        .expect(201);

      expect(response.body.question).toBe("What is your favorite childhood memory?");
      expect(response.body.id).toBeDefined();
      userSuggestionId = response.body.id;

      const fetched = await client.get(`/suggestions/${userSuggestionId}`).expect(200);
      expect(fetched.body.userId).toBe(userId);
      expect(fetched.body.accepted).toBe(false);
    });

    it("rejects an empty question with 400", async () => {
      await client.actingAs(user);
      await client.post("/suggestions").send({ userId, question: "" }).expect(400);
    });

    it("rejects a non-UUID userId with 400", async () => {
      await client.actingAs(user);
      await client.post("/suggestions").send({ userId: "not-a-uuid", question: "?" }).expect(400);
    });

    it("requires authentication", async () => {
      client.clearToken();
      await client
        .post("/suggestions")
        .send({ userId, question: "Anonymous question?" })
        .expect(401);
    });
  });

  describe("GET /suggestions", () => {
    it("creates an admin suggestion for ownership checks", async () => {
      await client.actingAs(admin);
      const me = await client.get("/users/me").expect(200);
      adminId = me.body.id;

      const response = await client
        .post("/suggestions")
        .send({ userId: "00000000-0000-0000-0000-000000000000", question: "Admin's own suggestion" })
        .expect(201);
      adminSuggestionId = response.body.id;
    });

    it("lists only the current user's suggestions", async () => {
      await client.actingAs(user);
      const response = await client.get("/suggestions").expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      // The list endpoint joins the user relation; ownership lives on user.id
      response.body.forEach((suggestion: any) => {
        expect(suggestion.user.id).toBe(userId);
      });
      expect(response.body.some((s: any) => s.id === adminSuggestionId)).toBe(false);
    });
  });

  describe("GET /suggestions/:id", () => {
    it("returns the owner's suggestion", async () => {
      await client.actingAs(user);
      const response = await client.get(`/suggestions/${userSuggestionId}`).expect(200);

      expect(response.body.id).toBe(userSuggestionId);
      expect(response.body.userId).toBe(userId);
    });

    it("forbids reading another user's suggestion with 403", async () => {
      await client.actingAs(user);
      await client.get(`/suggestions/${adminSuggestionId}`).expect(403);
    });

    it("lets an admin read any suggestion", async () => {
      await client.actingAs(admin);
      const response = await client.get(`/suggestions/${userSuggestionId}`).expect(200);
      expect(response.body.id).toBe(userSuggestionId);
    });

    it("returns 404 for a non-existent suggestion", async () => {
      await client.actingAs(user);
      await client.get("/suggestions/00000000-0000-0000-0000-000000000000").expect(404);
    });
  });

  describe("PATCH /suggestions/:id", () => {
    it("rejects updates from a non-admin with 403", async () => {
      await client.actingAs(user);
      await client.patch(`/suggestions/${userSuggestionId}`).send({ accepted: true }).expect(403);
    });

    it("lets an admin accept a suggestion", async () => {
      await client.actingAs(admin);
      const response = await client
        .patch(`/suggestions/${userSuggestionId}`)
        .send({ accepted: true })
        .expect(200);

      expect(response.body.accepted).toBe(true);
    });

    it("returns 404 when updating a non-existent suggestion", async () => {
      await client.actingAs(admin);
      await client
        .patch("/suggestions/00000000-0000-0000-0000-000000000000")
        .send({ accepted: true })
        .expect(404);
    });
  });

  describe("DELETE /suggestions/:id", () => {
    it("rejects deletion from a non-admin with 403", async () => {
      await client.actingAs(user);
      await client.delete(`/suggestions/${userSuggestionId}`).expect(403);
    });

    it("lets an admin delete a suggestion", async () => {
      await client.actingAs(admin);
      await client.delete(`/suggestions/${userSuggestionId}`).expect(204);
      await client.get(`/suggestions/${userSuggestionId}`).expect(404);
    });

    it("returns 404 when deleting a non-existent suggestion", async () => {
      await client.actingAs(admin);
      await client.delete("/suggestions/00000000-0000-0000-0000-000000000000").expect(404);
    });
  });
});
