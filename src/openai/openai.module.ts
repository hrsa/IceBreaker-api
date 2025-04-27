import { ConfigModule } from '@nestjs/config';
import { CardsModule } from '../cards/cards.module';
import { Module } from '@nestjs/common';
import { OpenAIService } from './openai.service';
import { TranslationService } from './translation.service';
import { TranslationsController } from './openai.controller';

@Module({
  imports: [
    ConfigModule,
    CardsModule,
  ],
  controllers: [TranslationsController],
  providers: [OpenAIService, TranslationService],
  exports: [OpenAIService, TranslationService]
})
export class OpenAiModule {}