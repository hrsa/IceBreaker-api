import { AppLanguage } from '../../common/constants/app-language.enum';
import { Card } from '../../cards/entities/card.entity';

export interface TelegramSession {
  language: AppLanguage;
  languageSelectionMessageId?: number;
  lastMessageText?: string;
  botMessageId?: number;
  userId?: string;
  card?: Card;
  selectedProfileId?: string;
  selectedCategoryIds?: string[];
  step?: "authentication" | "profile-selection" | "profile-creation" | "category-selection" | "card-retrieval";
  email?: string;
}