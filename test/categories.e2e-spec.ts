import { App } from "supertest/types";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { migrateAndSeed } from "./helpers/database.helper";
import { getTestApp } from "./config/setup";
import { TestClientHelper } from "./helpers/test-client.helper";
import { testUsers, testCategories } from "./seeders/test-data.seeder";
import { Card } from "../src/cards/entities/card.entity";
import { Category } from "../src/categories/entities/category.entity";

describe("Categories API (e2e)", () => {
  let app: INestApplication<App>;
  let api: App;
  let client: TestClientHelper;
  let dataSource: DataSource;

  const admin = testUsers.admin;
  const user = testUsers.user;

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

  describe("POST /categories", () => {
    it("lets an admin create a public category", async () => {
      await client.actingAs(admin);
      const response = await client.post("/categories").send({
        language: "en",
        name: "E2E Public Category",
        description: "Created by e2e test",
        isPublic: true,
      });

      expect(response.status).toBe(201);
      expect(response.body.name_en).toBe("E2E Public Category");
      expect(response.body.isPublic).toBe(true);
      expect(response.body.id).toBeDefined();
    });

    it("lets an admin create a private category", async () => {
      await client.actingAs(admin);
      const response = await client.post("/categories").send({
        language: "en",
        name: "E2E Private Category",
        description: "Private category created by e2e test",
        isPublic: false,
      });

      expect(response.status).toBe(201);
      expect(response.body.isPublic).toBe(false);
    });

    it("rejects creation by a non-admin with 403", async () => {
      await client.actingAs(user);
      await client
        .post("/categories")
        .send({
          language: "en",
          name: "Should Not Exist",
          description: "This must be rejected",
          isPublic: true,
        })
        .expect(403);
    });

    it("rejects creation without authentication with 401", async () => {
      client.clearToken();
      await client
        .post("/categories")
        .send({
          language: "en",
          name: "Anonymous Category",
          description: "This must be rejected",
          isPublic: true,
        })
        .expect(401);
    });

    it("rejects an invalid payload with 400", async () => {
      await client.actingAs(admin);
      await client.post("/categories").send({ language: "en", name: "", description: "" }).expect(400);
    });
  });

  describe("GET /categories", () => {
    it("returns the seeded public categories for a regular user", async () => {
      await client.actingAs(user);
      const response = await client.get("/categories").expect(200);

      const names = response.body.map((c: any) => c.name_en);
      expect(names).toContain(testCategories.first.name_en);
      expect(names).toContain(testCategories.second.name_en);
    });

    it("does not expose private categories to a regular user", async () => {
      await client.actingAs(user);
      const response = await client.get("/categories").expect(200);

      const privateCategories = response.body.filter((c: any) => c.isPublic === false);
      expect(privateCategories).toHaveLength(0);
    });

    it("lets an admin list private categories as well", async () => {
      await client.actingAs(admin);
      const response = await client.get("/categories").expect(200);

      const privateCategories = response.body.filter((c: any) => c.isPublic === false);
      expect(privateCategories.length).toBeGreaterThan(0);
    });

    it("requires authentication", async () => {
      client.clearToken();
      await client.get("/categories").expect(401);
    });
  });

  describe("GET /categories/:id", () => {
    it("returns a public category for any authenticated user", async () => {
      const categoryRepository = dataSource.getRepository(Category);
      const seeded = await categoryRepository.findOneOrFail({
        where: { name_en: testCategories.first.name_en },
      });

      await client.actingAs(user);
      const response = await client.get(`/categories/${seeded.id}`).expect(200);

      expect(response.body.id).toBe(seeded.id);
      expect(response.body.name_en).toBe(testCategories.first.name_en);
    });

    it("returns 404 for a non-existent category", async () => {
      await client.actingAs(user);
      await client.get("/categories/00000000-0000-0000-0000-000000000000").expect(404);
    });

    it("hides private categories from non-admin users with 404", async () => {
      const categoryRepository = dataSource.getRepository(Category);
      const privateCategory = await categoryRepository.findOneOrFail({
        where: { isPublic: false },
      });

      await client.actingAs(user);
      await client.get(`/categories/${privateCategory.id}`).expect(404);

      await client.actingAs(admin);
      const response = await client.get(`/categories/${privateCategory.id}`).expect(200);
      expect(response.body.id).toBe(privateCategory.id);
    });
  });

  describe("PATCH /categories/:id", () => {
    let targetCategory: Category;

    beforeAll(async () => {
      const categoryRepository = dataSource.getRepository(Category);
      targetCategory = await categoryRepository.save({
        name_en: "Category To Update",
        description_en: "Before update",
        isPublic: true,
      } as Partial<Category>);
    });

    it("lets an admin update a category", async () => {
      await client.actingAs(admin);
      const response = await client
        .patch(`/categories/${targetCategory.id}`)
        .send({ language: "en", name: "Updated Category Name" })
        .expect(200);

      expect(response.body.name_en).toBe("Updated Category Name");
    });

    it("rejects updates from a non-admin with 403", async () => {
      await client.actingAs(user);
      await client.patch(`/categories/${targetCategory.id}`).send({ language: "en", name: "Hacked Name" }).expect(403);
    });

    it("returns 404 when updating a non-existent category", async () => {
      await client.actingAs(admin);
      await client.patch("/categories/00000000-0000-0000-0000-000000000000").send({ language: "en", name: "Ghost" }).expect(404);
    });
  });

  describe("DELETE /categories/:id", () => {
    let targetCategory: Category;

    beforeAll(async () => {
      const categoryRepository = dataSource.getRepository(Category);
      targetCategory = await categoryRepository.save({
        name_en: "Category To Delete",
        description_en: "Will be removed",
        isPublic: true,
      } as Partial<Category>);
    });

    it("rejects deletion from a non-admin with 403", async () => {
      await client.actingAs(user);
      await client.delete(`/categories/${targetCategory.id}`).expect(403);
    });

    it("lets an admin delete a category", async () => {
      await client.actingAs(admin);
      await client.delete(`/categories/${targetCategory.id}`).expect(204);
      await client.get(`/categories/${targetCategory.id}`).expect(404);
    });

    it("returns 404 when deleting a non-existent category", async () => {
      await client.actingAs(admin);
      await client.delete("/categories/00000000-0000-0000-0000-000000000000").expect(404);
    });
  });

  describe("GET /categories/:id/cards-count", () => {
    it("returns the number of cards in a category", async () => {
      const categoryRepository = dataSource.getRepository(Category);
      const cardRepository = dataSource.getRepository(Card);

      const category = await categoryRepository.save({
        name_en: "Counted Category",
        description_en: "Has cards",
        isPublic: true,
      } as Partial<Category>);

      await cardRepository.save([
        { question_en: "Count question 1", categoryId: category.id },
        { question_en: "Count question 2", categoryId: category.id },
        { question_en: "Count question 3", categoryId: category.id },
      ]);

      await client.actingAs(user);
      const response = await client.get(`/categories/${category.id}/cards-count`).expect(200);

      expect(response.body.count).toBe(3);
    });

    it("returns 0 for a category without cards", async () => {
      const categoryRepository = dataSource.getRepository(Category);
      const category = await categoryRepository.save({
        name_en: "Empty Category",
        description_en: "No cards",
        isPublic: true,
      } as Partial<Category>);

      await client.actingAs(user);
      const response = await client.get(`/categories/${category.id}/cards-count`).expect(200);

      expect(response.body.count).toBe(0);
    });

    it("returns 404 for a non-existent category", async () => {
      await client.actingAs(user);
      await client.get("/categories/00000000-0000-0000-0000-000000000000/cards-count").expect(404);
    });
  });
});
