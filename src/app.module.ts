import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { UsersModule } from "./users/users.module";
import { ProfilesModule } from "./profiles/profiles.module";
import { CategoriesModule } from "./categories/categories.module";
import { CardsModule } from "./cards/cards.module";
import { CardPreferencesModule } from "./card-preferences/card-preferences.module";
import { AuthModule } from "./auth/auth.module";
import { SuggestionsModule } from "./suggestions/suggestions.module";
import { AIModule } from "./ai/ai.module";
import { TelegramModule } from "./telegram/telegram.module";
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from "nestjs-i18n";
import { join } from "path";
import { RedisSessionModule } from "./redis/redis-session.module";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { WebhooksModule } from "./webhooks/webhooks.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: "postgres",
        host: configService.getOrThrow("DB_HOST"),
        port: configService.getOrThrow<number>("DB_PORT"),
        username: configService.getOrThrow("DB_USER"),
        password: configService.getOrThrow("DB_PASSWORD"),
        database: configService.getOrThrow("DB_NAME"),
        entities: [__dirname + "/**/*.entity{.ts,.js}"],
        synchronize: false,
      }),
    }),
    I18nModule.forRootAsync({
      useFactory: () => ({
        fallbackLanguage: "en",
        loaderOptions: {
          path: join(__dirname, "/i18n/"),
        },
      }),
      resolvers: [{ use: QueryResolver, options: ["lang"] }, AcceptLanguageResolver, new HeaderResolver(["x-lang"])],
      inject: [ConfigService],
    }),
    EventEmitterModule.forRoot(),
    UsersModule,
    ProfilesModule,
    CategoriesModule,
    CardsModule,
    CardPreferencesModule,
    AuthModule,
    SuggestionsModule,
    AIModule,
    TelegramModule,
    RedisSessionModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
