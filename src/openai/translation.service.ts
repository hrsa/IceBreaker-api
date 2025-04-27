// src/openai/translation.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { CardsService } from '../cards/cards.service';
import { OpenAIService } from './openai.service';
import { Card, CardLanguage } from '../cards/entities/card.entity';

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  private readonly languageMap = {
    [CardLanguage.ENGLISH]: 'English',
    [CardLanguage.RUSSIAN]: 'Russian',
    [CardLanguage.FRENCH]: 'French',
    [CardLanguage.ITALIAN]: 'Italian',
  };

  constructor(
    private cardsService: CardsService,
    private openaiService: OpenAIService,
  ) {}
  
  async fillMissingTranslations(
    limit: number = 10,
    sourceLanguage?: CardLanguage,
    targetLanguages?: CardLanguage[],
  ): Promise<{ processed: number, updated: Card[] }> {
    const allCards = await this.cardsService.findAll();
    const allLanguages = Object.values(CardLanguage);

    const cardsWithMissingTranslations = allCards.filter(card => {
      const hasAtLeastOneLanguage = allLanguages.some(lang =>
        this.hasLanguageField(card, lang)
      );

      const hasMissingLanguages = allLanguages.some(lang =>
        !this.hasLanguageField(card, lang)
      );

      return hasAtLeastOneLanguage && hasMissingLanguages;
    });


    const cardsToProcess = cardsWithMissingTranslations.slice(0, limit);

    this.logger.log(`Found ${cardsWithMissingTranslations.length} cards with missing translations. Processing ${cardsToProcess.length}.`);

    const updatedCards: Card[] = [];

    for (const card of cardsToProcess) {
      const availableLanguages = allLanguages.filter(lang =>
        this.hasLanguageField(card, lang)
      );

      const missingLanguages = allLanguages.filter(lang =>
        !this.hasLanguageField(card, lang)
      );

      if (availableLanguages.length === 0) {
        this.logger.warn(`Card ${card.id} has no language content. Skipping.`);
        continue;
      }

      const effectiveSourceLanguage =
        (sourceLanguage && this.hasLanguageField(card, sourceLanguage))
          ? sourceLanguage
          : availableLanguages[0];

      const sourceText = this.getQuestionByLanguage(card, effectiveSourceLanguage);

      if (!sourceText) {
        this.logger.warn(`Card ${card.id} is missing source language text. Skipping.`);
        continue;
      }

      const effectiveTargetLanguages = targetLanguages
        ? targetLanguages.filter(lang => !this.hasLanguageField(card, lang))
        : missingLanguages;

      for (const targetLang of effectiveTargetLanguages) {
        try {
          this.logger.log(`Translating card ${card.id} from ${effectiveSourceLanguage} to ${targetLang}...`);

          const translatedText = await this.openaiService.translateText(
            sourceText,
            this.languageMap[targetLang]
          );

          const updateDto = {
            question: translatedText,
            language: targetLang,
          };

          const updatedCard = await this.cardsService.update(card.id, updateDto);
          updatedCards.push(updatedCard);

          this.logger.log(`Successfully translated card ${card.id} to ${targetLang}`);
        } catch (error) {
          this.logger.error(`Failed to translate card ${card.id} to ${targetLang}: ${error.message}`);
        }
      }
    }

    return {
      processed: cardsToProcess.length,
      updated: updatedCards,
    };
  }

  getQuestionWithFallback(card: Card, preferredLanguage: CardLanguage = CardLanguage.ENGLISH): string {
    const preferredText = this.getQuestionByLanguage(card, preferredLanguage);
    if (preferredText) return preferredText;

    if (preferredLanguage !== CardLanguage.ENGLISH) {
      const englishText = this.getQuestionByLanguage(card, CardLanguage.ENGLISH);
      if (englishText) return englishText;
    }

    for (const lang of Object.values(CardLanguage)) {
      if (lang !== preferredLanguage && lang !== CardLanguage.ENGLISH) {
        const text = this.getQuestionByLanguage(card, lang);
        if (text) return text;
      }
    }

    return '';
  }

  private hasLanguageField(card: Card, language: CardLanguage): boolean {
    switch (language) {
      case CardLanguage.ENGLISH:
        return !!card.question_en;
      case CardLanguage.RUSSIAN:
        return !!card.question_ru;
      case CardLanguage.FRENCH:
        return !!card.question_fr;
      case CardLanguage.ITALIAN:
        return !!card.question_it;
      default:
        return false;
    }
  }

  private getQuestionByLanguage(card: Card, language: CardLanguage): string | null {
    switch (language) {
      case CardLanguage.ENGLISH:
        return card.question_en;
      case CardLanguage.RUSSIAN:
        return card.question_ru;
      case CardLanguage.FRENCH:
        return card.question_fr;
      case CardLanguage.ITALIAN:
        return card.question_it;
      default:
        return null;
    }
  }
}