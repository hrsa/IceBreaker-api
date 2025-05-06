import { AppLanguage } from '../../common/constants/app-language.enum';
import { Card } from '../../cards/entities/card.entity';

export interface TelegramSession {
  language: AppLanguage;
  languageSelectionMessageId?: number;
  lastMessageText?: string;
  botMessageId?: number;
  botMessageIds?: number[];
  chatId?: number;
  userId?: string;
  suggestionText?: string;
  card?: Card;
  previousCard?: Card;
  includeArchived?: boolean;
  includeLoved?: boolean;
  selectedProfileId?: string;
  selectedCategoryIds?: string[];
  step?: "authentication" | "profile-selection" | "profile-creation" | "profile-deletion" | "category-selection" | "card-retrieval" | "suggestion-creation" | "signup-email" | "signup-name";
  email?: string;
}