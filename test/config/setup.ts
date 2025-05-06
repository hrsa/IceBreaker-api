import { TypeOrmModule } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { testDatabaseConfig } from './test-database.config';
import { exec } from 'child_process';
import { promisify } from 'util';
import { DataSource } from 'typeorm';
import { TestDataSeeder } from '../seeders/test-data.seeder';
import { INestApplication } from '@nestjs/common';
import { setupTestApp } from './app-test.module';

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

    try {
      const tmpDataSource = new DataSource({
        type: dbConfig.type,
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
      });

      await tmpDataSource.initialize();

      const result = await tmpDataSource.query(
        `SELECT 1 FROM pg_database WHERE datname = '${database}'`
      );

      if (result.length === 0) {
        await tmpDataSource.query(`CREATE DATABASE ${database}`);
        console.log(`Created database ${database}`);
      } else {
        console.log(`Database ${database} already exists`);
      }

      await tmpDataSource.destroy();
    } catch (error) {
      console.error('Error creating test database:', error);
      throw error;
    }
  }

  static async runMigrations(): Promise<void> {
    try {
      console.log('Running migrations on test database');
      // Run migrations using TypeORM CLI
      const result = await execPromise(
        `npx typeorm-ts-node-commonjs migration:run -d src/dataSource.ts`
      );
      console.log('Migration output:', result.stdout);
    } catch (error) {
      console.error('Error running migrations:', error.stderr || error);
      throw error;
    }
  }

  static async initializeTestDatabase(): Promise<void> {
    await this.createDatabase();
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
      console.log(`Dropped database ${database}`);

      await tmpDataSource.destroy();
    } catch (error) {
      console.error('Error dropping test database:', error);
      throw error;
    }

    return new Promise(resolve => setTimeout(resolve, 1000));
  }

  static async resetDatabase(dataSource: DataSource): Promise<void> {
    try {
      console.log('Resetting test database to initial state');

      // Truncate all tables (maintaining the schema)
      const entities = dataSource.entityMetadatas;

      // Disable foreign key checks
      await dataSource.query('SET session_replication_role = \'replica\';');


      // Clear tables in the correct order
      for (const entity of entities) {
        await dataSource.query(`TRUNCATE TABLE "${entity.tableName}" CASCADE;`);
      }

      // Re-enable foreign key checks
      await dataSource.query('SET session_replication_role = \'origin\';');

      // Seed with initial test data
      const seeder = new TestDataSeeder(dataSource);
      await seeder.seed();

      console.log('Database reset complete');
    } catch (error) {
      console.error('Error resetting database:', error);
      throw error;
    }
  }

  static async getTestModule(imports: any[]): Promise<TestingModule> {
    return Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testDatabaseConfig),
        ...imports
      ],
    }).compile();
  }
}