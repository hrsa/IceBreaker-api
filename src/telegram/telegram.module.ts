import { Module } from "@nestjs/common";
import { TelegrafModule, TelegrafModuleOptions } from "nestjs-telegraf";
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
import { ProfileCreationState } from "./states/profile-creation.state";
import { RedisSessionService } from "../redis/redis-session.middleware";
import { RedisSessionModule } from "../redis/redis-session.module";
import { SuggestionsModule } from "../suggestions/suggestions.module";
import { SuggestionCreationState } from "./states/suggestion-creation.state";
import { SignupEmailState } from "./states/signup-email.state";
import { SignupNameState } from "./states/signup-name.state";
import { CardPreferencesModule } from "../card-preferences/card-preferences.module";
import { ProfileDeletionState } from "./states/profile-deletion.state";
import { HelpState } from "./states/help.state";
import { BullModule } from "@nestjs/bullmq";
import { TelegramMessageProcessor } from "./telegram-message.processor";
import { GameGenerationState } from "./states/game-generation.state";
import { AIModule } from "../ai/ai.module";
import { session } from "telegraf";

@Module({
  imports: [
    TelegrafModule.forRootAsync({
      imports: [ConfigModule, RedisSessionModule],
      inject: [ConfigService, RedisSessionService],
      useFactory: (configService: ConfigService, redisSessionService: RedisSessionService) => {
        const appEnv = configService.get<string>("APP_ENV");

        if (appEnv === "testing") {
          return {
            token: configService.get<string>("TELEGRAM_BOT_TOKEN"),
            middlewares: [session()],
            include: [],
            options: { telegram: { testEnv: true } },
          } as TelegrafModuleOptions;
        }

        const options: Record<string, any> = {
          token: configService.get<string>("TELEGRAM_TEST_BOT_TOKEN"),
          middlewares: [redisSessionService.middleware()],
          include: [TelegramModule],
        };

        if (appEnv === "production") {
          options.token = configService.getOrThrow<string>("TELEGRAM_BOT_TOKEN");
          options.launchOptions = {
            webhook: {
              domain: configService.getOrThrow<string>("TELEGRAM_BOT_DOMAIN"),
              hookPath: configService.get<string>("TELEGRAM_BOT_HOOK_PATH", "/tg-webhook"),
            },
          };
        }

        return options as TelegrafModuleOptions;
      },
    }),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        connection: {
          host: configService.getOrThrow("REDIS_HOST"),
          port: configService.getOrThrow<number>("REDIS_PORT"),
          password: configService.getOrThrow("REDIS_PASSWORD"),
          db: configService.getOrThrow("REDIS_DB", 0),
        },
      }),
    }),
    BullModule.registerQueue({
      name: "telegram-messages",
    }),
    UsersModule,
    ProfilesModule,
    CategoriesModule,
    CardsModule,
    LanguageUtilsModule,
    SuggestionsModule,
    AIModule,
    CardPreferencesModule,
  ],
  providers: [
    TelegramService,
    TelegramUpdate,
    StateFactory,
    HelpState,
    AuthenticationState,
    ProfileSelectionState,
    ProfileCreationState,
    ProfileDeletionState,
    CategorySelectionState,
    CardRetrievalState,
    SuggestionCreationState,
    SignupEmailState,
    SignupNameState,
    GameGenerationState,
    RedisSessionService,
    TelegramMessageProcessor,
  ],
  exports: [TelegramService],
})
export class TelegramModule {}
