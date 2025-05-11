// test/config/setup.ts
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as dotenv from 'dotenv';
import { TestAppModule } from './test-app.module';

let app: INestApplication;

export async function getTestApp(): Promise<INestApplication> {
  if (!app) {
    dotenv.config({ path: '.env.test' });
    process.env.NODE_ENV = 'test';
    process.env.APP_ENV = 'testing';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }
  return app;
}