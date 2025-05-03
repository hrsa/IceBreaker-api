import { Module } from "@nestjs/common";
import { TelegrafModule } from "nestjs-telegraf";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TelegramService } from "./telegram.service";
import { TelegramUpdate } from "./telegram.update";
import { UsersModule } from "../users/users.module";
import { CategoriesModule } from "../categories/categories.module";
import { CardsModule } from "../cards/cards.module";
import { ProfilesModule } from "../profiles/profiles.module";
import { LanguageUtilsModule } from "../common/utils/language-utils.module";
import { StateFactory } from "./states/state.factory";
import { AuthenticationState } from "./states/authentication.state";
import { ProfileSelectionState } from "./states/profile-selection.state";
import { CategorySelectionState } from "./states/category-selection.state";
import { CardRetrievalState } from "./states/card-retrieval.state";
import { ProfileCreationState } from './states/profile-creation.state';
import { RedisSessionService } from '../redis/redis-session.middleware';
import { RedisSessionModule } from '../redis/redis-session.module';
import { SuggestionsModule } from '../suggestions/suggestions.module';
import { SuggestionCreationState } from './states/suggestion-creation.state';

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule, RedisSessionModule],
      inject: [ConfigService, RedisSessionService],
      useFactory: (configService: ConfigService, redisSessionService: RedisSessionService) => ({
        token: configService.getOrThrow<string>("TELEGRAM_BOT_TOKEN"),
        middlewares: [redisSessionService.middleware()],
        include: [TelegramModule],
      }),
    }),
    UsersModule,
    ProfilesModule,
    CategoriesModule,
    CardsModule,
    LanguageUtilsModule,
    SuggestionsModule
  ],
  providers: [
    TelegramService,
    TelegramUpdate,
    StateFactory,
    AuthenticationState,
    ProfileSelectionState,
    ProfileCreationState,
    CategorySelectionState,
    CardRetrievalState,
    SuggestionCreationState,
    RedisSessionService,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
