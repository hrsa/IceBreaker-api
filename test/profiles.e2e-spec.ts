import { App } from "supertest/types";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { migrateAndSeed } from "./helpers/database.helper";
import { getTestApp } from "./config/setup";
import { TestClientHelper } from "./helpers/test-client.helper";
import { testUsers } from "./seeders/test-data.seeder";
import { Profile } from "../src/profiles/entities/profile.entity";
import { Card } from "../src/cards/entities/card.entity";
import { Category } from "../src/categories/entities/category.entity";
import { CardPreference, CardStatus } from "../src/card-preferences/entitites/card-preference.entity";

describe("Profiles API (e2e)", () => {
  let app: INestApplication<App>;
  let api: App;
  let client: TestClientHelper;
  let dataSource: DataSource;

  const admin = testUsers.admin;
  const user = testUsers.user;
  let userId = "";
  let adminId = "";

  beforeAll(async () => {
    app = (await getTestApp()) as INestApplication<App>;
    api = app.getHttpServer();
    client = new TestClientHelper(api);
    dataSource = app.get(DataSource);
    await migrateAndSeed(app);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  async function getCurrentUserId(credentials: { email: string; password: string }): Promise<string> {
    await client.actingAs(credentials);
    const response = await client.get("/users/me").expect(200);
    return response.body.id;
  }

  describe("POST /profiles", () => {
    it("creates a profile for the current user", async () => {
      userId = await getCurrentUserId(user);
      client.clearToken();
      await client.actingAs(user);

      const response = await client.post("/profiles").send({ name: "My Profile" }).expect(201);

      expect(response.body.name).toBe("My Profile");
      expect(response.body.userId).toBe(userId);
      expect(response.body.id).toBeDefined();
    });

    it("forces the profile owner to the current user even when another userId is supplied", async () => {
      await client.actingAs(user);
      const response = await client
        .post("/profiles")
        .send({ name: "Sneaky Profile", userId: "00000000-0000-0000-0000-000000000000" })
        .expect(201);

      expect(response.body.userId).toBe(userId);
    });

    it("lets an admin create a profile for another user", async () => {
      adminId = await getCurrentUserId(admin);
      await client.actingAs(admin);

      const response = await client
        .post("/profiles")
        .send({ name: "Admin-Made Profile", userId: userId })
        .expect(201);

      expect(response.body.userId).toBe(userId);
      expect(response.body.name).toBe("Admin-Made Profile");
    });

    it("rejects an empty name with 400", async () => {
      await client.actingAs(user);
      await client.post("/profiles").send({ name: "" }).expect(400);
    });

    it("requires authentication", async () => {
      client.clearToken();
      await client.post("/profiles").send({ name: "Anonymous" }).expect(401);
    });
  });

  describe("GET /profiles", () => {
    it("lists only the current user's profiles", async () => {
      await client.actingAs(user);
      const response = await client.get("/profiles").expect(200);

      expect(response.body.length).toBeGreaterThan(0);
      response.body.forEach((profile: any) => {
        expect(profile.userId).toBe(userId);
      });
    });

    it("does not list another user's profiles", async () => {
      await client.actingAs(admin);
      const response = await client.get("/profiles").expect(200);

      const foreignProfiles = response.body.filter((p: any) => p.userId === userId);
      expect(foreignProfiles).toHaveLength(0);
    });
  });

  describe("GET /profiles/:id", () => {
    it("returns the owner's profile", async () => {
      await client.actingAs(user);
      const listResponse = await client.get("/profiles").expect(200);
      const profileId = listResponse.body[0].id;

      const response = await client.get(`/profiles/${profileId}`).expect(200);
      expect(response.body.id).toBe(profileId);
    });

    it("forbids access to another user's profile with 403", async () => {
      const adminProfile = await dataSource.getRepository(Profile).save({
        name: "Admin Only Profile",
        userId: adminId,
      } as Partial<Profile>);

      await client.actingAs(user);
      await client.get(`/profiles/${adminProfile.id}`).expect(403);
    });

    it("lets an admin access any profile", async () => {
      const userProfiles = await dataSource.getRepository(Profile).find({
        where: { userId },
      });

      await client.actingAs(admin);
      const response = await client.get(`/profiles/${userProfiles[0].id}`).expect(200);
      expect(response.body.id).toBe(userProfiles[0].id);
    });

    it("returns 404 for a non-existent profile", async () => {
      await client.actingAs(user);
      await client.get("/profiles/00000000-0000-0000-0000-000000000000").expect(404);
    });
  });

  describe("PATCH /profiles/:id", () => {
    it("lets the owner update their profile", async () => {
      await client.actingAs(user);
      const listResponse = await client.get("/profiles").expect(200);
      const profileId = listResponse.body[0].id;

      const response = await client
        .patch(`/profiles/${profileId}`)
        .send({ name: "Renamed Profile" })
        .expect(200);

      expect(response.body.name).toBe("Renamed Profile");
    });

    it("ignores userId changes in the update body", async () => {
      await client.actingAs(user);
      const listResponse = await client.get("/profiles").expect(200);
      const profileId = listResponse.body[0].id;

      const response = await client
        .patch(`/profiles/${profileId}`)
        .send({ userId: "00000000-0000-0000-0000-000000000000" })
        .expect(200);

      expect(response.body.userId).toBe(userId);
    });

    it("forbids updating another user's profile with 403", async () => {
      const adminProfile = await dataSource.getRepository(Profile).save({
        name: "Admin Patch Target",
        userId: adminId,
      } as Partial<Profile>);

      await client.actingAs(user);
      await client.patch(`/profiles/${adminProfile.id}`).send({ name: "Hacked" }).expect(403);
    });
  });

  describe("DELETE /profiles/:id", () => {
    it("forbids deleting another user's profile with 403", async () => {
      const adminProfile = await dataSource.getRepository(Profile).save({
        name: "Admin Delete Target",
        userId: adminId,
      } as Partial<Profile>);

      await client.actingAs(user);
      await client.delete(`/profiles/${adminProfile.id}`).expect(403);
    });

    it("lets the owner delete their profile", async () => {
      await client.actingAs(user);
      const createResponse = await client.post("/profiles").send({ name: "Doomed Profile" }).expect(201);
      const profileId = createResponse.body.id;

      await client.delete(`/profiles/${profileId}`).expect(204);
      await client.get(`/profiles/${profileId}`).expect(404);
    });

    it("returns 404 for a non-existent profile", async () => {
      await client.actingAs(user);
      await client.delete("/profiles/00000000-0000-0000-0000-000000000000").expect(404);
    });
  });

  describe("GET /profiles/:id/card-preferences", () => {
    it("returns the profile's card preferences, filtered by status", async () => {
      // Set up a profile with cards and preferences in different states
      const profileRepository = dataSource.getRepository(Profile);
      const categoryRepository = dataSource.getRepository(Category);
      const cardRepository = dataSource.getRepository(Card);
      const preferenceRepository = dataSource.getRepository(CardPreference);

      const profile = await profileRepository.save({
        name: "Preferences Profile",
        userId,
      } as Partial<Profile>);

      const category = await categoryRepository.save({
        name_en: "Preferences Category",
        description_en: "For preference tests",
        isPublic: true,
      } as Partial<Category>);

      const cards = await cardRepository.save([
        { question_en: "Pref question 1", categoryId: category.id } as Partial<Card>,
        { question_en: "Pref question 2", categoryId: category.id } as Partial<Card>,
      ]);

      await preferenceRepository.save([
        {
          profileId: profile.id,
          cardId: cards[0].id,
          status: CardStatus.ARCHIVED,
        } as Partial<CardPreference>,
        {
          profileId: profile.id,
          cardId: cards[1].id,
          status: CardStatus.LOVED,
        } as Partial<CardPreference>,
      ]);

      await client.actingAs(user);

      const allResponse = await client.get(`/profiles/${profile.id}/card-preferences`).expect(200);
      expect(allResponse.body).toHaveLength(2);

      const archivedResponse = await client
        .get(`/profiles/${profile.id}/card-preferences?status=archived`)
        .expect(200);
      expect(archivedResponse.body).toHaveLength(1);
      expect(archivedResponse.body[0].status).toBe(CardStatus.ARCHIVED);

      const lovedResponse = await client
        .get(`/profiles/${profile.id}/card-preferences?status=loved`)
        .expect(200);
      expect(lovedResponse.body).toHaveLength(1);
      expect(lovedResponse.body[0].status).toBe(CardStatus.LOVED);
    });

    it("forbids reading another user's profile preferences with 403", async () => {
      const profileRepository = dataSource.getRepository(Profile);
      const adminProfile = await profileRepository.save({
        name: "Admin Preferences Profile",
        userId: adminId,
      } as Partial<Profile>);

      await client.actingAs(user);
      await client.get(`/profiles/${adminProfile.id}/card-preferences`).expect(403);
    });
  });
});
