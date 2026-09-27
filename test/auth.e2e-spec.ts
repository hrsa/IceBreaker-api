import { App } from "supertest/types";
import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import * as request from "supertest";
import { migrateAndSeed } from "./helpers/database.helper";
import { getTestApp } from "./config/setup";
import { PasswordReset } from "../src/auth/entities/password-reset.entity";
import { TokenDto } from "../src/auth/dto/token.dto";

describe("Auth API (e2e)", () => {
  let app: INestApplication<App>;
  let api: App;
  let dataSource: DataSource;

  const user = {
    email: "auth-tester@test.net",
    password: "authpassword",
    name: "Auth Tester",
  };

  beforeAll(async () => {
    app = (await getTestApp()) as INestApplication<App>;
    api = app.getHttpServer();
    dataSource = app.get(DataSource);
    await migrateAndSeed(app);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  describe("POST /auth/register", () => {
    it("registers a new user", async () => {
      const response = await request(api).post("/auth/register").send(user).expect(201);

      expect(response.body.email).toBe(user.email);
      expect(response.body.name).toBe(user.name);
      expect(response.body.id).toBeDefined();
      expect(typeof response.body.secretPhrase).toBe("string");
      expect(response.body).not.toHaveProperty("password");
    });

    it("rejects an invalid email", async () => {
      await request(api)
        .post("/auth/register")
        .send({ ...user, email: "not-an-email" })
        .expect(400);
    });

    it("rejects a password shorter than 6 characters", async () => {
      await request(api)
        .post("/auth/register")
        .send({ ...user, email: "shortpw@test.net", password: "12345" })
        .expect(400);
    });

    it("rejects a missing name", async () => {
      await request(api).post("/auth/register").send({ email: "noname@test.net", password: "validpassword" }).expect(400);
    });

    it("rejects a duplicate email with 400", async () => {
      await request(api).post("/auth/register").send(user).expect(400);
    });
  });

  describe("POST /auth/login", () => {
    it("logs in with valid credentials and returns an access token", async () => {
      const { body } = await request(api).post("/auth/login").send(user).expect(200);
      const { accessToken } = body as TokenDto;

      expect(accessToken).toBeDefined();
      expect(typeof accessToken).toBe("string");
    });

    it("rejects a wrong password with 401", async () => {
      await request(api).post("/auth/login").send({ email: user.email, password: "wrongpassword" }).expect(401);
    });

    it("rejects a non-existent email with 401", async () => {
      await request(api).post("/auth/login").send({ email: "ghost@test.net", password: "whatever123" }).expect(401);
    });

    it("rejects empty credentials with 401", async () => {
      await request(api).post("/auth/login").send({}).expect(401);
    });
  });

  describe("POST /auth/password/forgot", () => {
    it("accepts a known email and creates a reset record", async () => {
      const { body } = await request(api).post("/auth/password/forgot").send({ email: user.email }).expect(200);

      expect(body.message).toContain("If you have an account");

      const resetRepository = dataSource.getRepository(PasswordReset);
      const record = await resetRepository.findOne({
        where: { used: false },
        order: { createdAt: "DESC" },
      });

      expect(record).not.toBeNull();
      if (!record) throw new Error("Password reset record was not created");
      expect(record.token).toBeDefined();
      expect(record.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("does not reveal whether an unknown email exists", async () => {
      const knownResponse = await request(api).post("/auth/password/forgot").send({ email: user.email }).expect(200);

      const unknownResponse = await request(api).post("/auth/password/forgot").send({ email: "no-such-user@test.net" }).expect(200);

      expect(unknownResponse.body.message).toBe(knownResponse.body.message);
    });
  });

  describe("POST /auth/password/reset", () => {
    it("resets the password with a valid token and allows login with the new password", async () => {
      // Request a fresh reset token
      await request(api).post("/auth/password/forgot").send({ email: user.email }).expect(200);

      const resetRepository = dataSource.getRepository(PasswordReset);
      const record = await resetRepository.findOne({
        where: { used: false },
        order: { createdAt: "DESC" },
      });
      expect(record).not.toBeNull();
      if (!record) throw new Error("Password reset record was not created");

      const newPassword = "brand-new-password";
      await request(api).post("/auth/password/reset").send({ token: record.token, password: newPassword }).expect(200);

      // Old password no longer works
      await request(api).post("/auth/login").send({ email: user.email, password: user.password }).expect(401);

      // New password works
      const loginResponse = await request(api).post("/auth/login").send({ email: user.email, password: newPassword }).expect(200);
      expect((loginResponse.body as TokenDto).accessToken).toBeDefined();

      // Token cannot be reused
      await request(api).post("/auth/password/reset").send({ token: record.token, password: "another-password" }).expect(401);
    });

    it("rejects an invalid token with 401", async () => {
      await request(api).post("/auth/password/reset").send({ token: "invalid-token-value", password: "some-password" }).expect(401);
    });
  });
});
