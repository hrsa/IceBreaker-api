import { TypeOrmModule } from "@nestjs/typeorm";
import { Test, TestingModule } from "@nestjs/testing";
import { testDatabaseConfig } from "./test-database.config";
import { exec } from "child_process";
import { promisify } from "util";
import { DataSource } from "typeorm";
import { INestApplication } from "@nestjs/common";
import { setupTestApp } from "./app-test.module";

const execPromise = promisify(exec);

let app: INestApplication;

export async function getTestApp(): Promise<INestApplication> {
  if (!app) {
    app = await setupTestApp();
  }
  return app;
}

export class TestSetup {
  static async createDatabase(): Promise<void> {
    const { database, ...dbConfig } = testDatabaseConfig as any;

    console.log("Creating test database:", database);
    console.log("Database config:", dbConfig);

    try {
      const tmpDataSource = new DataSource({
        type: dbConfig.type,
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
      });

      await tmpDataSource.initialize();

      const result = await tmpDataSource.query(`SELECT 1 FROM pg_database WHERE datname = '${database}'`);

      if (result.length === 0) {
        await tmpDataSource.query(`CREATE DATABASE ${database}`);
      }

      await tmpDataSource.destroy();
    } catch (error) {
      console.error("Error creating test database:", error);
      throw error;
    }
  }

  static async runMigrations(): Promise<void> {
    try {
      await execPromise(`npx typeorm-ts-node-commonjs migration:run -d src/dataSource.ts`);
    } catch (error) {
      console.error("Error running migrations:", error.stderr || error);
      throw error;
    }
  }

  static async initializeTestDatabase(): Promise<void> {
    await this.runMigrations();
  }

  static async cleanupDatabase(): Promise<void> {
    try {
      const { database, ...dbConfig } = testDatabaseConfig as any;

      const tmpDataSource = new DataSource({
        type: dbConfig.type,
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
      } as any);

      await tmpDataSource.initialize();

      await tmpDataSource.query(`
          SELECT pg_terminate_backend(pg_stat_activity.pid)
          FROM pg_stat_activity
          WHERE pg_stat_activity.datname = '${database}'
            AND pid <> pg_backend_pid();
      `);

      await tmpDataSource.query(`DROP DATABASE IF EXISTS ${database}`);

      await tmpDataSource.destroy();
    } catch (error) {
      console.error("Error dropping test database:", error);
      throw error;
    }

    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  static async resetDatabase(dataSource: DataSource): Promise<void> {
    try {
      const entities = dataSource.entityMetadatas;
      await dataSource.query("SET session_replication_role = 'replica';");

      for (const entity of entities) {
        await dataSource.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
      }
      await dataSource.query("SET session_replication_role = 'origin';");
    } catch (error) {
      console.error("Error resetting database:", error);
      throw error;
    }
  }

  static async getTestModule(imports: any[]): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [TypeOrmModule.forRoot(testDatabaseConfig), ...imports],
    }).compile();
  }
}
