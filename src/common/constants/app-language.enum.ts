import { Card } from "../../cards/entities/card.entity";
import { Category } from "../../categories/entities/category.entity";

export enum AppLanguage {
  ENGLISH = "en",
  RUSSIAN = "ru",
  FRENCH = "fr",
  ITALIAN = "it",
}

export type EntityWithLanguageProperties = Card | Category;
