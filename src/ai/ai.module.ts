import { ConfigModule } from '@nestjs/config';
import { CardsModule } from '../cards/cards.module';
import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { TranslationService } from './translation.service';
import { AIController } from './ai.controller';
import { LanguageUtilsModule } from '../common/utils/language-utils.module';
import { CategoriesModule } from '../categories/categories.module';
import { GameGenerationStoreService } from './game-generation-store.service';
import { RedisSessionModule } from '../redis/redis-session.module';

@Module({
  imports: [
    ConfigModule,
    CardsModule,
    CategoriesModule,
    LanguageUtilsModule,
    RedisSessionModule
  ],
  controllers: [AIController],
  providers: [AIService, TranslationService, GameGenerationStoreService],
  exports: [AIService, TranslationService]
})
export class AIModule {}