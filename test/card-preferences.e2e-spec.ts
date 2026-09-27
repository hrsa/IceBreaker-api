import { App } from "supertest/types";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { migrateAndSeed } from "./helpers/database.helper";
import { getTestApp } from "./config/setup";
import { TestClientHelper } from "./helpers/test-client.helper";
import { testUsers } from "./seeders/test-data.seeder";
import { Profile } from "../src/profiles/entities/profile.entity";
import { User } from "../src/users/entities/user.entity";
import { Card } from "../src/cards/entities/card.entity";
import { Category } from "../src/categories/entities/category.entity";
import { CardPreference, CardStatus } from "../src/card-preferences/entitites/card-preference.entity";

describe("Card Preferences API (e2e)", () => {
  let app: INestApplication<App>;
  let api: App;
  let client: TestClientHelper;
  let dataSource: DataSource;

  const admin = testUsers.admin;
  const user = testUsers.user;

  let userId = "";
  let testProfile: Profile;
  let foreignProfile: Profile;
  let testCards: Card[] = [];

  beforeAll(async () => {
    app = (await getTestApp()) as INestApplication<App>;
    api = app.getHttpServer();
    client = new TestClientHelper(api);
    dataSource = app.get(DataSource);
    await migrateAndSeed(app);

    // Identify the seeded user
    await client.actingAs(user);
    const meResponse = await client.get("/users/me").expect(200);
    userId = meResponse.body.id;

    const adminEntity = await dataSource
      .getRepository(User)
      .findOneByOrFail({ email: admin.email });

    const profileRepository = dataSource.getRepository(Profile);
    const categoryRepository = dataSource.getRepository(Category);
    const cardRepository = dataSource.getRepository(Card);

    testProfile = await profileRepository.save({
      name: "Preferences Owner Profile",
      userId,
    } as Partial<Profile>);

    foreignProfile = await profileRepository.save({
      name: "Foreign Profile",
      userId: adminEntity.id,
    } as Partial<Profile>);

    const category = await categoryRepository.save({
      name_en: "Card Preferences Category",
      description_en: "For card preference tests",
      isPublic: true,
    } as Partial<Category>);

    testCards = await cardRepository.save([
      { question_en: "Preference card 1", categoryId: category.id } as Partial<Card>,
      { question_en: "Preference card 2", categoryId: category.id } as Partial<Card>,
      { question_en: "Preference card 3", categoryId: category.id } as Partial<Card>,
      { question_en: "Preference card 4", categoryId: category.id } as Partial<Card>,
    ]);

    // Seed preferences in every status for the filter tests
    const preferenceRepository = dataSource.getRepository(CardPreference);
    await preferenceRepository.save([
      { profileId: testProfile.id, cardId: testCards[0].id, status: CardStatus.ACTIVE } as Partial<CardPreference>,
      { profileId: testProfile.id, cardId: testCards[1].id, status: CardStatus.ARCHIVED } as Partial<CardPreference>,
      { profileId: testProfile.id, cardId: testCards[2].id, status: CardStatus.BANNED } as Partial<CardPreference>,
      { profileId: testProfile.id, cardId: testCards[3].id, status: CardStatus.LOVED } as Partial<CardPreference>,
    ]);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe("GET /card-preferences", () => {
    it("returns all preferences for the owner's profile", async () => {
      await client.actingAs(user);
      const response = await client.get(`/card-preferences?profileId=${testProfile.id}`).expect(200);

      expect(response.body).toHaveLength(4);
      const statuses = response.body.map((p: any) => p.status).sort();
      expect(statuses).toEqual([CardStatus.ACTIVE, CardStatus.ARCHIVED, CardStatus.BANNED, CardStatus.LOVED].sort());
    });

    it("filters by status", async () => {
      await client.actingAs(user);
      const response = await client
        .get(`/card-preferences?profileId=${testProfile.id}&status=archived`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe(CardStatus.ARCHIVED);
      expect(response.body[0].card.id).toBe(testCards[1].id);
    });

    it("requires authentication", async () => {
      client.clearToken();
      await client.get(`/card-preferences?profileId=${testProfile.id}`).expect(401);
    });

    it("forbids reading another user's profile preferences with 403", async () => {
      await client.actingAs(user);
      await client.get(`/card-preferences?profileId=${foreignProfile.id}`).expect(403);
    });

    it("lets an admin read any profile's preferences", async () => {
      await client.actingAs(admin);
      const response = await client
        .get(`/card-preferences?profileId=${testProfile.id}`)
        .expect(200);

      expect(response.body.length).toBeGreaterThan(0);
    });
  });

  describe("status-specific endpoints", () => {
    it("returns only active preferences", async () => {
      await client.actingAs(user);
      const response = await client.get(`/card-preferences/active?profileId=${testProfile.id}`).expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe(CardStatus.ACTIVE);
    });

    it("returns only archived preferences", async () => {
      await client.actingAs(user);
      const response = await client.get(`/card-preferences/archived?profileId=${testProfile.id}`).expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe(CardStatus.ARCHIVED);
    });

    it("returns only banned preferences", async () => {
      await client.actingAs(user);
      const response = await client.get(`/card-preferences/banned?profileId=${testProfile.id}`).expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe(CardStatus.BANNED);
    });

    it("returns only loved preferences", async () => {
      await client.actingAs(user);
      const response = await client.get(`/card-preferences/loved?profileId=${testProfile.id}`).expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].status).toBe(CardStatus.LOVED);
    });
  });

  describe("PUT /card-preferences/:cardId/profile/:profileId", () => {
    it("archives a card and returns the preference", async () => {
      const cardRepository = dataSource.getRepository(Card);
      const categoryRepository = dataSource.getRepository(Category);
      const category = await categoryRepository.save({
        name_en: "PUT Preference Category",
        description_en: "For PUT tests",
        isPublic: true,
      } as Partial<Category>);
      const card = await cardRepository.save({
        question_en: "PUT preference card",
        categoryId: category.id,
      } as Partial<Card>);

      await client.actingAs(user);
      const response = await client
        .put(`/card-preferences/${card.id}/profile/${testProfile.id}`)
        .send({ status: CardStatus.ARCHIVED })
        .expect(200);

      expect(response.body.status).toBe(CardStatus.ARCHIVED);
      expect(response.body.cardId).toBe(card.id);
      expect(response.body.profileId).toBe(testProfile.id);
    });

    it("is idempotent: archiving twice still succeeds", async () => {
      await client.actingAs(user);
      const first = await client
        .put(`/card-preferences/${testCards[1].id}/profile/${testProfile.id}`)
        .send({ status: CardStatus.ARCHIVED })
        .expect(200);
      const second = await client
        .put(`/card-preferences/${testCards[1].id}/profile/${testProfile.id}`)
        .send({ status: CardStatus.ARCHIVED })
        .expect(200);

      expect(second.body.id).toBe(first.body.id);
      expect(second.body.status).toBe(CardStatus.ARCHIVED);
    });

    it("returns 204 when reactivating (status ACTIVE) removes the preference", async () => {
      await client.actingAs(user);
      await client
        .put(`/card-preferences/${testCards[2].id}/profile/${testProfile.id}`)
        .send({ status: CardStatus.ACTIVE })
        .expect(204);

      // The banned preference is gone
      const bannedResponse = await client
        .get(`/card-preferences/banned?profileId=${testProfile.id}`)
        .expect(200);
      expect(bannedResponse.body).toHaveLength(0);
    });

    it("returns 204 when reactivating a card that has no preference", async () => {
      const cardRepository = dataSource.getRepository(Card);
      const card = await cardRepository.save({
        question_en: "Never touched card",
        categoryId: testCards[0].categoryId,
      } as Partial<Card>);

      await client.actingAs(user);
      await client
        .put(`/card-preferences/${card.id}/profile/${testProfile.id}`)
        .send({ status: CardStatus.ACTIVE })
        .expect(204);
    });

    it("returns 404 for a non-existent card", async () => {
      await client.actingAs(user);
      await client
        .put(`/card-preferences/00000000-0000-0000-0000-000000000000/profile/${testProfile.id}`)
        .send({ status: CardStatus.ARCHIVED })
        .expect(404);
    });

    it("rejects a non-existent profile with 403 (guard blocks before service lookup)", async () => {
      // ProfileOwnerGuard denies profiles the caller does not own, so a
      // non-existent profile id is rejected with 403, not 404.
      await client.actingAs(user);
      await client
        .put(`/card-preferences/${testCards[0].id}/profile/00000000-0000-0000-0000-000000000000`)
        .send({ status: CardStatus.ARCHIVED })
        .expect(403);
    });

    it("forbids updating preferences of a foreign profile with 403", async () => {
      await client.actingAs(user);
      await client
        .put(`/card-preferences/${testCards[0].id}/profile/${foreignProfile.id}`)
        .send({ status: CardStatus.ARCHIVED })
        .expect(403);
    });
  });

  describe("POST status shortcuts", () => {
    it("archives a card", async () => {
      await client.actingAs(user);
      // POST endpoints use the NestJS default status code 201
      const response = await client
        .post(`/card-preferences/${testCards[3].id}/profile/${testProfile.id}/archive`)
        .expect(201);

      expect(response.body.status).toBe(CardStatus.ARCHIVED);
    });

    it("bans a card", async () => {
      await client.actingAs(user);
      // POST endpoints use the NestJS default status code 201
      const response = await client
        .post(`/card-preferences/${testCards[3].id}/profile/${testProfile.id}/ban`)
        .expect(201);

      expect(response.body.status).toBe(CardStatus.BANNED);
    });

    it("loves a card", async () => {
      await client.actingAs(user);
      // POST endpoints use the NestJS default status code 201
      const response = await client
        .post(`/card-preferences/${testCards[3].id}/profile/${testProfile.id}/love`)
        .expect(201);

      expect(response.body.status).toBe(CardStatus.LOVED);
    });

    it("reactivates a card with 204 and clears the preference", async () => {
      await client.actingAs(user);
      await client
        .post(`/card-preferences/${testCards[3].id}/profile/${testProfile.id}/reactivate`)
        .expect(204);

      const lovedResponse = await client
        .get(`/card-preferences/loved?profileId=${testProfile.id}`)
        .expect(200);
      expect(lovedResponse.body).toHaveLength(0);
    });

    it("forbids acting on a foreign profile with 403", async () => {
      await client.actingAs(user);
      await client
        .post(`/card-preferences/${testCards[0].id}/profile/${foreignProfile.id}/archive`)
        .expect(403);
    });
  });
});
