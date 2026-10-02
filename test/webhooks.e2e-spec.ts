import { App } from "supertest/types";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import request from "supertest";
import { migrateAndSeed } from "./helpers/database.helper";
import { getTestApp } from "./config/setup";
import { testUsers } from "./seeders/test-data.seeder";
import { User } from "../src/users/entities/user.entity";

function kofiPayload(overrides: Record<string, unknown> = {}) {
  return {
    verification_token: process.env.KOFI_VERIFICATION_TOKEN || "39512934-28fe-41af-a1e1-bf1d825a9e2b",
    message_id: "test-message-id",
    timestamp: new Date().toISOString(),
    type: "Donation",
    is_public: true,
    from_name: "Test Donor",
    message: "Great project!",
    amount: "5",
    url: "",
    email: testUsers.user.email,
    currency: "USD",
    is_subscription_payment: false,
    is_first_subscription_payment: false,
    kofi_transaction_id: "test-transaction-id",
    shop_items: null,
    tier_name: null,
    shipping: null,
    ...overrides,
  };
}

describe("Webhooks API (e2e)", () => {
  let app: INestApplication<App>;
  let api: App;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = (await getTestApp()) as INestApplication<App>;
    api = app.getHttpServer();
    dataSource = app.get(DataSource);
    await migrateAndSeed(app);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  async function getCredits(email: string): Promise<number> {
    const user = await dataSource.getRepository(User).findOneByOrFail({ email });
    return user.credits;
  }

  // donation handler is async: poll briefly for credits to settle
  async function waitForCredits(email: string, expected: number, timeoutMs = 3000): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    let credits = await getCredits(email);
    while (credits !== expected && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 50));
      credits = await getCredits(email);
    }
    return credits;
  }

  describe("POST /webhooks/ko-fi", () => {
    it("processes a valid donation and credits the user", async () => {
      const creditsBefore = await getCredits(testUsers.user.email);

      await request(api)
        .post("/webhooks/ko-fi")
        .send({ data: JSON.stringify(kofiPayload()) })
        .expect(200);

      const creditsAfter = await waitForCredits(testUsers.user.email, creditsBefore + 5);
      expect(creditsAfter).toBe(creditsBefore + 5);
    });

    it("processes a subscription payment like a donation", async () => {
      const creditsBefore = await getCredits(testUsers.user.email);

      await request(api)
        .post("/webhooks/ko-fi")
        .send({
          data: JSON.stringify(kofiPayload({ type: "Subscription", amount: "3" })),
        })
        .expect(200);

      expect(await waitForCredits(testUsers.user.email, creditsBefore + 3)).toBe(creditsBefore + 3);
    });

    it("rejects an invalid verification token without crediting anyone", async () => {
      const creditsBefore = await getCredits(testUsers.user.email);

      const response = await request(api)
        .post("/webhooks/ko-fi")
        .send({
          data: JSON.stringify(kofiPayload({ verification_token: "forged-token" })),
        })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Invalid verification token");
      expect(await getCredits(testUsers.user.email)).toBe(creditsBefore);
    });

    it("acknowledges but ignores unhandled payment types", async () => {
      const creditsBefore = await getCredits(testUsers.user.email);

      const response = await request(api)
        .post("/webhooks/ko-fi")
        .send({ data: JSON.stringify(kofiPayload({ type: "Commission" })) })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("not handled");
      expect(await getCredits(testUsers.user.email)).toBe(creditsBefore);
    });

    it("returns an error for malformed JSON", async () => {
      const response = await request(api).post("/webhooks/ko-fi").send({ data: "this is not json" }).expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Error processing webhook");
    });

    it("returns an error when the data field is missing", async () => {
      const response = await request(api).post("/webhooks/ko-fi").send({}).expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Error processing webhook");
    });

    it("does not crash for a donation from an unknown email", async () => {
      const response = await request(api)
        .post("/webhooks/ko-fi")
        .send({
          data: JSON.stringify(kofiPayload({ email: "stranger@test.net" })),
        })
        .expect(200);

      expect(response.body).toBeDefined();
    });
  });
});
