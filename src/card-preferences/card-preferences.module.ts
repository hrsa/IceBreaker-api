import { Module } from "@nestjs/common";
import { CardPreferencesController } from "./card-preferences.controller";
import { CardPreferencesService } from "./card-preferences.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CardPreference } from "./entitites/card-preference.entity";
import { ProfilesModule } from "../profiles/profiles.module";
import { CardsModule } from "../cards/cards.module";

@Module({
  imports: [TypeOrmModule.forFeature([CardPreference]), ProfilesModule, CardsModule],
  controllers: [CardPreferencesController],
  providers: [CardPreferencesService],
  exports: [CardPreferencesService],
})
export class CardPreferencesModule {}
