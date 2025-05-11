import { INestApplication } from "@nestjs/common";
import { DataSource } from "typeorm";
import { TestDataSeeder } from "../seeders/test-data.seeder";

export async function migrateAndSeed(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  await dataSource.runMigrations();
  await seedTestData(dataSource);
}

export async function seedTestData(dataSource: DataSource): Promise<void> {
  const seeder = new TestDataSeeder(dataSource);
  await seeder.seed();
}
