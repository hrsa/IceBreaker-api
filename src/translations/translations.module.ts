import { ConfigModule } from '@nestjs/config';
import { CardsModule } from '../cards/cards.module';
import { Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { TranslationService } from './translation.service';
import { TranslationsController } from './translations.controller';
import { LanguageUtilsModule } from '../common/utils/language-utils.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    ConfigModule,
    CardsModule,
    CategoriesModule,
    LanguageUtilsModule,
  ],
  controllers: [TranslationsController],
  providers: [OpenAIService, TranslationService],
  exports: [OpenAIService, TranslationService]
})
export class TranslationsModule {}