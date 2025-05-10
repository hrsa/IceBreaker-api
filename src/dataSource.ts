import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { join } from "path";
import { User } from "./users/entities/user.entity";
import { Card } from "./cards/entities/card.entity";
import { Profile } from "./profiles/entities/profile.entity";
import { CardPreference } from "./card-preferences/entitites/card-preference.entity";
import { Suggestion } from "./suggestions/entities/suggestion.entity";
import { Category } from "./categories/entities/category.entity";

dotenv.config();

export default new DataSource({
  type: "postgres",
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  username: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "postgres",
  database: process.env.DB_NAME || "postgres",
  entities: [User, Card, Category, Profile, CardPreference, Suggestion],
  migrations: [join(__dirname, "migrations/**/*{.ts,.js}")],
});
