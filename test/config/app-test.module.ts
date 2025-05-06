import { Test, TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { AppModule } from '../../src/app.module';
import { INestApplication } from '@nestjs/common';

export async function setupTestApp(): Promise<INestApplication> {
  process.env.NODE_ENV = 'test';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: '.env.test',
      }),
      AppModule
    ],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return app;
}