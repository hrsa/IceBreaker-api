import { App } from "supertest/types";
import { INestApplication } from "@nestjs/common";
import { resetDatabase } from "./helpers/database.helper";
import { getTestApp } from "./config/setup";
import { UserResponseDto } from "../src/users/dto/user-response.dto";
import { TestClientHelper } from "./helpers/test-client.helper";
import { plainToInstance } from "class-transformer";

describe("Users API (e2e)", () => {
  let app: INestApplication<App>;
  let api: App;
  let client: TestClientHelper;
  let user = {
    email: "tester@test.net",
    password: "testingpassword",
    name: "Tester",
  };
  let admin = {
    email: "admin@example.com",
    password: "adminpassword",
    name: "Admin",
  };
  let userId = "";
  let adminId = "";

  beforeAll(async () => {
    app = await getTestApp();
    api = app.getHttpServer();
    client = new TestClientHelper(api);
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  it("creates a new user", async () => {
    const response = await client.post("/users").send(user).expect(201);
    const userResponse = response.body as UserResponseDto;
    userId = userResponse.id;
    expect(userResponse).toMatchObject({});
    expect(userResponse).toMatchObject({
      email: user.email,
      name: user.name,
      isActivated: true,
    });
    expect(userResponse.id).toBeDefined();
    expect(typeof userResponse.secretPhrase).toBe("string");
  });

  test("user can login with correct password", async () => {
    await client.actingAs(user);

    const response = await client.post("/auth/login").send(user).expect(200);
    expect(response.body.accessToken).toBeDefined();

    client.clearToken();
    await client
      .post("/auth/login")
      .send({
        email: user.email,
        password: "wrongpassword",
      })
      .expect(401);
  });

  test("logged in user can get their profile", async () => {
    await client.actingAs(user);

    const getMeResponse = await client.get("/users/me").expect(200);
    expect(getMeResponse.body).toMatchObject({
      email: user.email,
      isActivated: true,
    });

    client.clearToken();
    await client.get("/users/me").expect(401);
  });

  test("only admins can get all users", async () => {
    await client.actingAs(user);
    await client.get("/users").expect(403);

    await client.actingAs(admin);
    const response = await client.get("/users").expect(200);
    expect(response.body).toHaveLength(3);
    response.body.forEach((userData: UserResponseDto) => {
      const userDto = plainToInstance(UserResponseDto, userData, {
        excludeExtraneousValues: true,
      });
      expect(userDto).toHaveProperty("id");
      expect(userDto).toHaveProperty("email");
      expect(userDto).toHaveProperty("name");
      expect(userDto).toHaveProperty("isActivated");
      expect(userDto).toHaveProperty("isAdmin");
      expect(userDto).toHaveProperty("createdAt");
      expect(userDto).toHaveProperty("telegramId");
      expect(userDto).toHaveProperty("secretPhrase");
    });
  });

  test("only admins can get a single user", async () => {
    await client.actingAs(user);
    let response = await client.get("/users/me").expect(200);
    userId = response.body.id;

    await client.actingAs(admin);
    response = await client.get("/users/me").expect(200);
    adminId = response.body.id;

    client.clearToken();
    await client.get(`/users/${userId}`).expect(401);
    await client.get(`/users/${adminId}`).expect(401);

    await client.actingAs(user);
    await client.get(`/users/${userId}`).expect(403);
    await client.get(`/users/${adminId}`).expect(403);

    await client.actingAs(admin);
    response = await client.get(`/users/${userId}`).expect(200);
    expect(response.body.id).toBe(userId);
    expect(response.body.isAdmin).toBe(false);
    expect(response.body.email).toBe(user.email);
    expect(response.body.name).toBe(user.name);
    response = await client.get(`/users/${adminId}`).expect(200);
    expect(response.body.id).toBe(adminId);
    expect(response.body.isAdmin).toBe(true);
    expect(response.body.email).toBe(admin.email);
    expect(response.body.name).toBe(admin.name);
  });

  test("user can update only their profile", async () => {
    await client.actingAs(user);
    let response = await client
      .patch(`/users/${userId}`)
      .send({
        name: "New Name",
      })
      .expect(200);
    expect(response.body.name).toBe("New Name");
    expect(response.body.email).toBe(user.email);

    response = await client.get(`/users/me`).expect(200);
    expect(response.body.id).toBe(userId);
    expect(response.body.email).toBe(user.email);
    expect(response.body.name).not.toBe(user.name);
    expect(response.body.name).toBe("New Name");

    await client
      .patch(`/users/${adminId}`)
      .send({
        name: "New Name 2",
      })
      .expect(403);

    client.clearToken();
    await client
      .patch(`/users/${userId}`)
      .send({
        name: "New Name 2",
      })
      .expect(401);
  });

  test("admin can update any user", async () => {
    await client.actingAs(admin);
    let response = await client
      .patch(`/users/${userId}`)
      .send({
        name: "Different Name",
      })
      .expect(200);
    expect(response.body.name).not.toBe("New Name");
    expect(response.body.name).toBe("Different Name");
    expect(response.body.email).toBe(user.email);

    await client.actingAs(user);
    response = await client.get(`/users/me`).expect(200);
    expect(response.body.id).toBe(userId);
    expect(response.body.email).toBe(user.email);
    expect(response.body.name).toBe("Different Name");
  });

  test("user can delete only their profile", async () => {
    await client.actingAs(user);
    await client.delete(`/users/${adminId}`).expect(403);

    await client.delete(`/users/${userId}`).expect(204);
    try {
      await client.actingAs(user);
      fail('Authentication should have failed but succeeded');
    } catch (error) {
      expect(error.message).toContain('Failed to authenticate: 401');
    }
  });

  test("admin can delete any user", async () => {
    let response = await client.post("/users").send(user).expect(201);
    userId = response.body.id;

    await client.actingAs(admin);
    await client.delete(`/users/${userId}`).expect(204);
    await client.delete(`/users/${userId}`).expect(404);
    await client.delete(`/users/${adminId}`).expect(204);
    try {
      await client.actingAs(user);
      fail('Authentication should have failed but succeeded');
    } catch (error) {
      expect(error.message).toContain('Failed to authenticate: 401');
    }
  })
});
