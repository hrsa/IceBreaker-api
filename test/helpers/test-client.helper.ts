import * as request from 'supertest';
import { App } from 'supertest/types';
import { Test } from 'supertest';

export class TestClientHelper {
  private readonly app: App
  private token: string | null = null;

  constructor(app: App) {
    this.app = app;
  }


  public setToken(token: string): this {
    this.token = token;
    return this;
  }

  public clearToken(): this {
    this.token = null;
    return this;
  }

  public async actingAs(credentials: { email: string; password: string }): Promise<this> {
    const response = await request(this.app)
      .post('/auth/login')
      .send(credentials);

    if (response.status !== 200) {
      throw new Error(`Failed to authenticate: ${response.status}`);
    }

    this.setToken(response.body.accessToken);
    return this;
  }

  public get(url: string): Test {
    const req = request(this.app).get(url);
    if (this.token) {
      req.set('Authorization', `Bearer ${this.token}`);
    }
    return req;
  }

  public post(url: string): Test {
    const req = request(this.app).post(url);
    if (this.token) {
      req.set('Authorization', `Bearer ${this.token}`);
    }
    return req;
  }

  public put(url: string): Test {
    const req = request(this.app).put(url);
    if (this.token) {
      req.set('Authorization', `Bearer ${this.token}`);
    }
    return req;
  }

  public patch(url: string): Test {
    const req = request(this.app).patch(url);
    if (this.token) {
      req.set('Authorization', `Bearer ${this.token}`);
    }
    return req;
  }

  public delete(url: string): Test {
    const req = request(this.app).delete(url);
    if (this.token) {
      req.set('Authorization', `Bearer ${this.token}`);
    }
    return req;
  }

  public async registerAndLogin(userData: {
    email: string;
    password: string;
    name: string;
  }): Promise<{ user: any; client: TestClientHelper }> {
    // Create user
    const userResponse = await request(this.app)
      .post('/users')
      .send(userData);

    if (userResponse.status !== 201) {
      throw new Error(`Failed to create user: ${userResponse.status}`);
    }

    await this.actingAs({
      email: userData.email,
      password: userData.password,
    });

    return {
      user: userResponse.body,
      client: this,
    };
  }
}