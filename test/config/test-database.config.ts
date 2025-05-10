import { TypeOrmModuleOptions } from "@nestjs/typeorm";
import { join } from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.test" });

export const testDatabaseConfig: TypeOrmModuleOptions = {
  type: "postgres",
  host: process.env.DB_HOST || "db",
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 5432,
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "test_icebreaker",
  entities: [join(__dirname, "../../src/**/*.entity{.ts,.js}")],
  synchronize: false,
  dropSchema: false,
};
