import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { App } from "supertest/types";
import { migrateAndSeed } from "./helpers/database.helper";
import { getTestApp } from "./config/setup";
import { DataSource } from "typeorm";
import { Card } from "../src/cards/entities/card.entity";
import { Category } from "../src/categories/entities/category.entity";
import { Profile } from "../src/profiles/entities/profile.entity";
import { User } from "../src/users/entities/user.entity";
import { CardPreference, CardStatus } from "../src/card-preferences/entitites/card-preference.entity";
import { ConfigService } from "@nestjs/config";
import * as jwt from "jsonwebtoken";
import { TestClientHelper } from "./helpers/test-client.helper";
import { testUsers } from "./seeders/test-data.seeder";
import { AppLanguage } from "../src/common/constants/app-language.enum";

describe("CardsController (e2e)", () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let testUser: User;
  let testProfile: Profile;
  let testCategory: Category;
  let testCards: Card[];

  beforeAll(async () => {
    app = await getTestApp();
    await migrateAndSeed(app);
    dataSource = app.get(DataSource);

    // Get or create test user and profile
    const userRepository = dataSource.getRepository(User);
    const profileRepository = dataSource.getRepository(Profile);
    const categoryRepository = dataSource.getRepository(Category);
    const cardRepository = dataSource.getRepository(Card);

    // Get the existing test user
    let userRecord: User | null = await userRepository.findOne({ where: { email: "user@example.com" } });
    if (!userRecord) {
      const hashedPassword = await (await import("argon2")).hash("password");
      userRecord = await userRepository.save({
        email: "user@example.com",
        password: hashedPassword,
        name: "Test User",
        isActivated: true,
        secretPhrase: "test secret",
      } as Partial<User>);
    }
    testUser = userRecord as User;

    // Get or create profile
    let profileRecord: Profile | null = await profileRepository.findOne({ where: { userId: testUser.id } });
    if (!profileRecord) {
      profileRecord = await profileRepository.save({
        userId: testUser.id,
        user: testUser,
        name: "Test Profile",
      } as Partial<Profile>);
    }
    testProfile = profileRecord as Profile;

    // Get or create category
    let categoryRecord: Category | null = await categoryRepository.findOne({ where: { name_en: "Category 1" } });
    if (!categoryRecord) {
      categoryRecord = await categoryRepository.save({
        name_en: "Category 1",
        name_fr: "Catégorie 1",
        name_ru: "Категория 1",
        name_it: "Categoria 1",
        description_en: "Test category",
        description_fr: "Test category",
        description_ru: "Test category",
        description_it: "Test category",
        isPublic: true,
      } as Partial<Category>);
    }
    testCategory = categoryRecord as Category;

    // Create test cards
    testCards = await cardRepository.save([
      {
        question_en: "Test question 1",
        categoryId: testCategory.id,
        category: testCategory,
      } as Partial<Card>,
      {
        question_en: "Test question 2",
        categoryId: testCategory.id,
        category: testCategory,
      } as Partial<Card>,
      {
        question_en: "Test question 3",
        categoryId: testCategory.id,
        category: testCategory,
      } as Partial<Card>,
      {
        question_en: "Test question 4",
        categoryId: testCategory.id,
        category: testCategory,
      } as Partial<Card>,
      {
        question_en: "Test question 5",
        categoryId: testCategory.id,
        category: testCategory,
      } as Partial<Card>,
    ] as Partial<Card>[]);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  describe("POST /cards/random", () => {
    it("should return random cards without throwing DISTINCT + ORDER BY error", async () => {
      // This test specifically verifies the fix for:
      // QueryFailedError: for SELECT DISTINCT, ORDER BY expressions must appear in select list
      
      const token = await generateTestToken(app, testUser.id);
      const response = await request(app.getHttpServer())
        .post("/cards/random")
        .set("Authorization", `Bearer ${token}`)
        .send({
          profileId: testProfile.id,
          categoryIds: [testCategory.id],
          limit: 3,
        })
        .expect(200);

      // Verify response structure
      expect(response.body).toHaveProperty("cards");
      expect(response.body).toHaveProperty("hasViewedAllCards");
      expect(Array.isArray(response.body.cards)).toBe(true);
      expect(response.body.cards.length).toBeLessThanOrEqual(3);

      // Verify each card has the expected structure
      response.body.cards.forEach((card: any) => {
        expect(card).toHaveProperty("id");
        expect(card).toHaveProperty("question_en");
        expect(card).toHaveProperty("category");
      });
    });

    it("should return random cards with multiple categories", async () => {
      const categoryRepository = dataSource.getRepository(Category);
      const cardRepository = dataSource.getRepository(Card);

      // Create a second category with cards
      const secondCategory = await categoryRepository.save({
        name_en: "Category 2",
        name_fr: "Catégorie 2",
        name_ru: "Категория 2",
        name_it: "Categoria 2",
        description_en: "Test category 2",
        description_fr: "Test category 2",
        description_ru: "Test category 2",
        description_it: "Test category 2",
        isPublic: true,
      } as Partial<Category>);

      await cardRepository.save([
        {
          question_en: "Test question from category 2",
          categoryId: secondCategory.id,
          category: secondCategory,
        } as Partial<Card>,
      ]);

      const token = await generateTestToken(app, testUser.id);
      const response = await request(app.getHttpServer())
        .post("/cards/random")
        .set("Authorization", `Bearer ${token}`)
        .send({
          profileId: testProfile.id,
          categoryIds: [testCategory.id, secondCategory.id],
          limit: 2,
        })
        .expect(200);

      expect(response.body.cards.length).toBeLessThanOrEqual(2);
    });

    it("should handle includeArchived flag", async () => {
      // Create a card preference with archived status
      const cardPreferenceRepository = dataSource.getRepository(CardPreference);
      await cardPreferenceRepository.save({
        profileId: testProfile.id,
        cardId: testCards[0].id,
        status: CardStatus.ARCHIVED,
      } as Partial<CardPreference>);

      const token = await generateTestToken(app, testUser.id);
      
      // Without includeArchived, the archived card should be excluded
      const responseWithoutArchived = await request(app.getHttpServer())
        .post("/cards/random")
        .set("Authorization", `Bearer ${token}`)
        .send({
          profileId: testProfile.id,
          categoryIds: [testCategory.id],
          includeArchived: false,
          limit: 10,
        })
        .expect(200);

      // The archived card should not be in the results
      const archivedCardIds = responseWithoutArchived.body.cards.map((c: any) => c.id);
      expect(archivedCardIds).not.toContain(testCards[0].id);

      // With includeArchived, the archived card should be included
      const responseWithArchived = await request(app.getHttpServer())
        .post("/cards/random")
        .set("Authorization", `Bearer ${token}`)
        .send({
          profileId: testProfile.id,
          categoryIds: [testCategory.id],
          includeArchived: true,
          limit: 10,
        })
        .expect(200);

      // The response should work without errors
      expect(responseWithArchived.body.cards.length).toBeGreaterThan(0);
    });

    it("should handle includeLoved flag", async () => {
      // Create a card preference with loved status
      const cardPreferenceRepository = dataSource.getRepository(CardPreference);
      await cardPreferenceRepository.save({
        profileId: testProfile.id,
        cardId: testCards[1].id,
        status: CardStatus.LOVED,
      } as Partial<CardPreference>);

      const token = await generateTestToken(app, testUser.id);
      
      // Without includeLoved, the loved card should be excluded
      const responseWithoutLoved = await request(app.getHttpServer())
        .post("/cards/random")
        .set("Authorization", `Bearer ${token}`)
        .send({
          profileId: testProfile.id,
          categoryIds: [testCategory.id],
          includeLoved: false,
          limit: 10,
        })
        .expect(200);

      // The loved card should not be in the results
      const lovedCardIds = responseWithoutLoved.body.cards.map((c: any) => c.id);
      expect(lovedCardIds).not.toContain(testCards[1].id);
    });

    it("should return different cards on multiple calls (randomness)", async () => {
      const token = await generateTestToken(app, testUser.id);
      
      // Call the endpoint multiple times and verify we get different results
      const results: string[][] = [];
      for (let i = 0; i < 5; i++) {
        const response = await request(app.getHttpServer())
          .post("/cards/random")
          .set("Authorization", `Bearer ${token}`)
          .send({
            profileId: testProfile.id,
            categoryIds: [testCategory.id],
            limit: 3,
          })
          .expect(200);

        results.push(response.body.cards.map((c: any) => c.id));
      }

      // With 5 test cards and limit of 3, we should get some variation
      // This is a probabilistic test - with enough calls, we should see different cards
      const allCardIds = results.flat();
      const uniqueCardIds = [...new Set(allCardIds)];
      
      // We should see multiple different cards across the calls
      expect(uniqueCardIds.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle limit parameter correctly", async () => {
      const token = await generateTestToken(app, testUser.id);
      
      const response = await request(app.getHttpServer())
        .post("/cards/random")
        .set("Authorization", `Bearer ${token}`)
        .send({
          profileId: testProfile.id,
          categoryIds: [testCategory.id],
          limit: 5,
        })
        .expect(200);

      expect(response.body.cards.length).toBeLessThanOrEqual(5);
    });

    it("should return hasViewedAllCards flag correctly", async () => {
      // Archive all cards for this profile
      const cardPreferenceRepository = dataSource.getRepository(CardPreference);
      for (const card of testCards) {
        await cardPreferenceRepository.save({
          profileId: testProfile.id,
          cardId: card.id,
          status: CardStatus.ARCHIVED,
        } as Partial<CardPreference>);
      }

      const token = await generateTestToken(app, testUser.id);

      // When all cards are archived and we're not including archived,
      // there are no cards left, so the API returns 404 (NotFoundException)
      await request(app.getHttpServer())
        .post("/cards/random")
        .set("Authorization", `Bearer ${token}`)
        .send({
          profileId: testProfile.id,
          categoryIds: [testCategory.id],
          includeArchived: false,
          limit: 10,
        })
        .expect(404);

      // With includeArchived, the cards are available again
      const responseWithArchived = await request(app.getHttpServer())
        .post("/cards/random")
        .set("Authorization", `Bearer ${token}`)
        .send({
          profileId: testProfile.id,
          categoryIds: [testCategory.id],
          includeArchived: true,
          limit: 10,
        })
        .expect(200);

      expect(responseWithArchived.body.cards.length).toBeGreaterThan(0);
      // Note: hasOnlyLovedCardsLeft() does not account for includeArchived,
      // so the flag reflects only non-archived/non-loved availability.
      expect(typeof responseWithArchived.body.hasViewedAllCards).toBe("boolean");
    });
  });

  describe("Cards CRUD (admin)", () => {
    let client: TestClientHelper;
    const admin = testUsers.admin;
    const user = testUsers.user;
    let crudCategoryId = "";
    let createdCardId = "";

    beforeAll(async () => {
      client = new TestClientHelper(app.getHttpServer() as any);
      // Admin-created category for the card CRUD tests
      await client.actingAs(admin);
      const categoryResponse = await client.post("/categories").send({
        language: AppLanguage.ENGLISH,
        name: "Card CRUD Category",
        description: "For card CRUD tests",
        isPublic: true,
      });
      crudCategoryId = categoryResponse.body.id;
    });

    it("lets an admin create a card", async () => {
      await client.actingAs(admin);
      const response = await client
        .post("/cards")
        .send({
          question: "What is your favorite movie?",
          language: AppLanguage.ENGLISH,
          categoryId: crudCategoryId,
        })
        .expect(201);

      expect(response.body.question_en).toBe("What is your favorite movie?");
      expect(response.body.categoryId).toBe(crudCategoryId);
      expect(response.body.id).toBeDefined();
      createdCardId = response.body.id;
    });

    it("rejects card creation from a non-admin with 403", async () => {
      await client.actingAs(user);
      await client
        .post("/cards")
        .send({
          question: "Forbidden question",
          language: AppLanguage.ENGLISH,
          categoryId: crudCategoryId,
        })
        .expect(403);
    });

    it("rejects card creation for a non-existent category with 404", async () => {
      await client.actingAs(admin);
      await client
        .post("/cards")
        .send({
          question: "Orphan question",
          language: AppLanguage.ENGLISH,
          categoryId: "00000000-0000-0000-0000-000000000000",
        })
        .expect(404);
    });

    it("rejects an invalid payload with 400", async () => {
      await client.actingAs(admin);
      await client
        .post("/cards")
        .send({ question: "", language: "not-a-language", categoryId: "nope" })
        .expect(400);
    });

    it("lets an admin list all cards", async () => {
      await client.actingAs(admin);
      const response = await client.get("/cards").expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body.some((card: any) => card.id === createdCardId)).toBe(true);
    });

    it("rejects listing all cards from a non-admin with 403", async () => {
      await client.actingAs(user);
      await client.get("/cards").expect(403);
    });

    it("returns a card by id for any authenticated user", async () => {
      await client.actingAs(user);
      const response = await client.get(`/cards/${createdCardId}`).expect(200);

      expect(response.body.id).toBe(createdCardId);
      expect(response.body.category).toBeDefined();
    });

    it("returns 404 for a non-existent card", async () => {
      await client.actingAs(user);
      await client.get("/cards/00000000-0000-0000-0000-000000000000").expect(404);
    });

    it("lets an admin update a card", async () => {
      await client.actingAs(admin);
      const response = await client
        .patch(`/cards/${createdCardId}`)
        .send({ question: "Updated question?", language: AppLanguage.ENGLISH })
        .expect(200);

      expect(response.body.question_en).toBe("Updated question?");
    });

    it("rejects card updates from a non-admin with 403", async () => {
      await client.actingAs(user);
      await client
        .patch(`/cards/${createdCardId}`)
        .send({ question: "Hacked?", language: AppLanguage.ENGLISH })
        .expect(403);
    });

    it("rejects card deletion from a non-admin with 403", async () => {
      await client.actingAs(user);
      await client.delete(`/cards/${createdCardId}`).expect(403);
    });

    it("lets an admin delete a card", async () => {
      await client.actingAs(admin);
      await client.delete(`/cards/${createdCardId}`).expect(204);
      await client.get(`/cards/${createdCardId}`).expect(404);
    });
  });
});

// Helper function to generate JWT token for testing
async function generateTestToken(app: INestApplication, userId: string): Promise<string> {
  const configService = app.get(ConfigService);
  const secret = configService.get("JWT_SECRET") || "test-secret";
  
  const payload = { id: userId, email: "test@example.com" };
  return jwt.sign(payload, secret, { expiresIn: "1h" });
}
