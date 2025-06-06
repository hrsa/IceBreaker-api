import { join } from "path";
import * as dotenv from "dotenv";
import { DataSourceOptions } from "typeorm";

dotenv.config({ path: ".env.test" });

export const testDataSourceOptions = {
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "postgres",
  entities: [join(__dirname, "../../src/**/*.entity{.ts,.js}")],
  migrations: [join(__dirname, "../../src/migrations/**/*{.ts,.js}")],
  dropSchema: true,
} as DataSourceOptions;
