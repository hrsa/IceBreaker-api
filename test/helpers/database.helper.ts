import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TestSetup } from '../config/setup';
import { TestDataSeeder } from '../seeders/test-data.seeder';

export async function resetDatabase(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  await TestSetup.resetDatabase(dataSource);
}

export async function seedTestData(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const seeder = new TestDataSeeder(dataSource);
  await seeder.seed();
}