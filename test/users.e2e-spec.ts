import * as request from 'supertest';
import { App } from 'supertest/types';
import { INestApplication } from '@nestjs/common';
import { resetDatabase } from './helpers/database.helper';
import { getTestApp } from './config/setup';
import { UserResponseDto } from '../src/users/dto/user-response.dto';

describe('Users API (e2e)', () => {
  let app: INestApplication<App>;
  let api: App


  beforeAll(async () => {
    app = await getTestApp();
    api = app.getHttpServer();
  });

  afterAll(async () => {
    await resetDatabase(app);
    await app.close();
  });

  it("creates a new user", async () => {
    const newUserData = {
      email: "tester@test.net",
      password: "testingpassword",
      name: "Tester",
    };

    const response = await request(api).post("/users").send(newUserData).expect(201);
    const user = response.body as UserResponseDto;
    expect(user).toMatchObject({
      email: newUserData.email,
      name: newUserData.name,
      isActivated: true,
    });
    expect(user.id).toBeDefined();
    expect(typeof user.secretPhrase).toBe('string');
  });
});
