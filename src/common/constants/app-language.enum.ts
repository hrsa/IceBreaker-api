import { Card } from "../../cards/entities/card.entity";
import { Category } from "../../categories/entities/category.entity";

export enum AppLanguage {
  ENGLISH = "en",
  RUSSIAN = "ru",
  FRENCH = "fr",
  ITALIAN = "it",
}

export const languageMap = {
  [AppLanguage.ENGLISH]: "English",
  [AppLanguage.RUSSIAN]: "Russian",
  [AppLanguage.FRENCH]: "French",
  [AppLanguage.ITALIAN]: "Italian",
};

export type EntityWithLanguageProperties = Card | Category;
