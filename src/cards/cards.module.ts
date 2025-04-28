import { Module } from '@nestjs/common';
import { CardsController } from './cards.controller';
import { CardsService } from './cards.service';
import { Card } from './entities/card.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CardPreference } from '../card-preferences/entitites/card-preference.entity';
import { CategoriesModule } from '../categories/categories.module';
import { LanguageUtilsModule } from '../common/utils/language-utils.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Card, CardPreference]), 
    CategoriesModule,
    LanguageUtilsModule
  ],
  controllers: [CardsController],
  providers: [CardsService],
  exports: [CardsService],
})
export class CardsModule {}
