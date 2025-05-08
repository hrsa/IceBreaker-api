import { Injectable, Logger } from "@nestjs/common";
import { CardsService } from "../cards/cards.service";
import { CategoriesService } from "../categories/categories.service";
import { OpenAIService } from "./openai.service";
import { Card } from "../cards/entities/card.entity";
import { Category } from "../categories/entities/category.entity";
import { AppLanguage } from "../common/constants/app-language.enum";
import { LanguageUtilsService } from "../common/utils/language-utils.service";
import { OnEvent } from "@nestjs/event-emitter";

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly allLanguages = Object.values(AppLanguage);

  private readonly languageMap = {
    [AppLanguage.ENGLISH]: "English",
    [AppLanguage.RUSSIAN]: "Russian",
    [AppLanguage.FRENCH]: "French",
    [AppLanguage.ITALIAN]: "Italian",
  };

  constructor(
    private cardsService: CardsService,
    private categoriesService: CategoriesService,
    private openAIService: OpenAIService,
    private languageUtilsService: LanguageUtilsService
  ) {}

  async fillMissingTranslations(
    limit: number = 10,
    sourceLanguage?: AppLanguage,
    targetLanguages?: AppLanguage[]
  ): Promise<{ processed: number; updated: Card[] }> {
    const allCards = await this.cardsService.findAll();

    const cardsWithMissingTranslations = allCards.filter(card => {
      const hasAtLeastOneLanguage = this.allLanguages.some(lang => this.languageUtilsService.hasPropertyByLanguage(card, "question", lang));

      const hasMissingLanguages = this.allLanguages.some(lang => !this.languageUtilsService.hasPropertyByLanguage(card, "question", lang));

      return hasAtLeastOneLanguage && hasMissingLanguages;
    });

    const cardsToProcess = cardsWithMissingTranslations.slice(0, limit);

    this.logger.log(`Found ${cardsWithMissingTranslations.length} cards with missing translations. Processing ${cardsToProcess.length}.`);

    const updatedCards: Card[] = [];

    for (const card of cardsToProcess) {
      try {
        let updatedCard = await this.translateCard(card, sourceLanguage, targetLanguages);
        updatedCards.push(updatedCard);
      } catch (e) {
        this.logger.error(`Failed to translate card ${card.id}: ${e.message}`);
      }
    }
    return {
      processed: cardsToProcess.length,
      updated: updatedCards,
    };
  }

  async translateCard(card: Card, sourceLanguage?: AppLanguage, targetLanguages?: AppLanguage[]): Promise<Card> {
    const availableLanguages = this.allLanguages.filter(lang => this.languageUtilsService.hasPropertyByLanguage(card, "question", lang));

    const missingLanguages = this.allLanguages.filter(lang => !this.languageUtilsService.hasPropertyByLanguage(card, "question", lang));

    if (availableLanguages.length === 0) {
      this.logger.warn(`Card ${card.id} has no language content. Skipping.`);
    }

    const effectiveSourceLanguage =
      sourceLanguage && this.languageUtilsService.hasPropertyByLanguage(card, "question", sourceLanguage)
        ? sourceLanguage
        : availableLanguages[0];

    const sourceText = this.languageUtilsService.getPropertyByLanguage(card, "question", effectiveSourceLanguage);

    if (!sourceText) {
      this.logger.warn(`Card ${card.id} is missing source language text. Skipping.`);
      throw new Error(`Card ${card.id} is missing source language text. Skipping.`);
    }

    const effectiveTargetLanguages = targetLanguages
      ? targetLanguages.filter(lang => !this.languageUtilsService.hasPropertyByLanguage(card, "question", lang))
      : missingLanguages;

    for (const targetLang of effectiveTargetLanguages) {
      try {
        this.logger.log(`Translating card ${card.id} from ${effectiveSourceLanguage} to ${targetLang}...`);

        const translatedText = await this.openAIService.translateText(sourceText, this.languageMap[targetLang]);

        const updateDto = {
          question: translatedText,
          language: targetLang,
        };

        this.logger.log(`Successfully translated card ${card.id} to ${targetLang}`);
        await this.cardsService.update(card.id, updateDto);
      } catch (error) {
        this.logger.error(`Failed to translate card ${card.id} to ${targetLang}: ${error.message}`);
        throw new Error(`Failed to update card ${card.id}`);
      }
    }

    return card;
  }

  async fillMissingCategoryTranslations(
    limit: number = 10,
    sourceLanguage?: AppLanguage,
    targetLanguages?: AppLanguage[]
  ): Promise<{ processed: number; updated: Category[] }> {
    const allCategories = await this.categoriesService.findAll();
    const allLanguages = Object.values(AppLanguage);

    // Filter categories with at least one language but missing some translations
    const categoriesWithMissingTranslations = allCategories.filter(category => {
      const hasAtLeastOneNameLanguage = allLanguages.some(lang => this.languageUtilsService.hasPropertyByLanguage(category, "name", lang));
      const hasMissingNameLanguages = allLanguages.some(lang => !this.languageUtilsService.hasPropertyByLanguage(category, "name", lang));

      const hasAtLeastOneDescLanguage = allLanguages.some(lang =>
        this.languageUtilsService.hasPropertyByLanguage(category, "description", lang)
      );
      const hasMissingDescLanguages = allLanguages.some(
        lang => !this.languageUtilsService.hasPropertyByLanguage(category, "description", lang)
      );

      return (hasAtLeastOneNameLanguage && hasMissingNameLanguages) || (hasAtLeastOneDescLanguage && hasMissingDescLanguages);
    });

    const categoriesToProcess = categoriesWithMissingTranslations.slice(0, limit);

    this.logger.log(
      `Found ${categoriesWithMissingTranslations.length} categories with missing translations. Processing ${categoriesToProcess.length}.`
    );

    const updatedCategories: Category[] = [];

    for (const category of categoriesToProcess) {
      await this.translateCategoryProperty(category, "name", sourceLanguage, targetLanguages, updatedCategories);

      await this.translateCategoryProperty(category, "description", sourceLanguage, targetLanguages, updatedCategories);
    }

    return {
      processed: categoriesToProcess.length,
      updated: updatedCategories,
    };
  }

  @OnEvent("category.created")
  async translateCategoryOnCreate(category: Category): Promise<void> {
    this.logger.log(`Translating category ${category.id} on creation...`);
    await this.translateCategoryProperty(category, "name");

    await this.translateCategoryProperty(category, "description");
  }

  @OnEvent("card.created")
  async translateCardOnCreate(card: Card): Promise<void> {
    this.logger.log(`Translating card ${card.id} on creation...`);
    await this.translateCard(card);
  }

  private async translateCategoryProperty(
    category: Category,
    propertyPrefix: "name" | "description",
    sourceLanguage?: AppLanguage,
    targetLanguages?: AppLanguage[],
    updatedCategories: Category[] = []
  ): Promise<void> {
    const allLanguages = Object.values(AppLanguage);

    const availableLanguages = allLanguages.filter(lang => this.languageUtilsService.hasPropertyByLanguage(category, propertyPrefix, lang));

    const missingLanguages = allLanguages.filter(lang => !this.languageUtilsService.hasPropertyByLanguage(category, propertyPrefix, lang));

    if (availableLanguages.length === 0) {
      this.logger.warn(`Category ${category.id} has no ${propertyPrefix} language content. Skipping.`);
      return;
    }

    const effectiveSourceLanguage =
      sourceLanguage && this.languageUtilsService.hasPropertyByLanguage(category, propertyPrefix, sourceLanguage)
        ? sourceLanguage
        : availableLanguages[0];

    const sourceText = this.languageUtilsService.getPropertyByLanguage(category, propertyPrefix, effectiveSourceLanguage);

    if (!sourceText) {
      this.logger.warn(`Category ${category.id} is missing ${propertyPrefix} source language text. Skipping.`);
      return;
    }

    const effectiveTargetLanguages = targetLanguages
      ? targetLanguages.filter(lang => !this.languageUtilsService.hasPropertyByLanguage(category, propertyPrefix, lang))
      : missingLanguages;

    for (const targetLang of effectiveTargetLanguages) {
      try {
        this.logger.log(`Translating category ${category.id} ${propertyPrefix} from ${effectiveSourceLanguage} to ${targetLang}...`);

        const translatedText = await this.openAIService.translateText(sourceText, this.languageMap[targetLang]);

        const updateDto: any = {
          language: targetLang,
        };
        updateDto[propertyPrefix] = translatedText;

        const updatedCategory = await this.categoriesService.update(category.id, updateDto);

        if (!updatedCategories.some(cat => cat.id === updatedCategory.id)) {
          updatedCategories.push(updatedCategory);
        }

        this.logger.log(`Successfully translated category ${category.id} ${propertyPrefix} to ${targetLang}`);
      } catch (error) {
        this.logger.error(`Failed to translate category ${category.id} ${propertyPrefix} to ${targetLang}: ${error.message}`);
      }
    }
  }

  getQuestionWithFallback(card: Card, preferredLanguage: AppLanguage = AppLanguage.ENGLISH): string {
    const preferredText = this.languageUtilsService.getPropertyByLanguage(card, "question", preferredLanguage);
    if (preferredText) return preferredText;

    if (preferredLanguage !== AppLanguage.ENGLISH) {
      const englishText = this.languageUtilsService.getPropertyByLanguage(card, "question", AppLanguage.ENGLISH);
      if (englishText) return englishText;
    }

    for (const lang of Object.values(AppLanguage)) {
      if (lang !== preferredLanguage && lang !== AppLanguage.ENGLISH) {
        const text = this.languageUtilsService.getPropertyByLanguage(card, "question", lang);
        if (text) return text;
      }
    }

    return "";
  }

  getCategoryPropertyWithFallback(
    category: Category,
    propertyPrefix: "name" | "description",
    preferredLanguage: AppLanguage = AppLanguage.ENGLISH
  ): string {
    const preferredText = this.languageUtilsService.getPropertyByLanguage(category, propertyPrefix, preferredLanguage);
    if (preferredText) return preferredText;

    if (preferredLanguage !== AppLanguage.ENGLISH) {
      const englishText = this.languageUtilsService.getPropertyByLanguage(category, propertyPrefix, AppLanguage.ENGLISH);
      if (englishText) return englishText;
    }

    for (const lang of Object.values(AppLanguage)) {
      if (lang !== preferredLanguage && lang !== AppLanguage.ENGLISH) {
        const text = this.languageUtilsService.getPropertyByLanguage(category, propertyPrefix, lang);
        if (text) return text;
      }
    }

    return "";
  }
}
