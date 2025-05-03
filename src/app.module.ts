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
import { TranslationsModule } from "./translations/translations.module";
import { TelegramModule } from "./telegram/telegram.module";
import { AcceptLanguageResolver, HeaderResolver, I18nModule, QueryResolver } from "nestjs-i18n";
import { join } from "path";
import { RedisSessionModule } from './redis/redis-session.module';

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
        synchronize: configService.get<boolean>("DB_SYNC", false),
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
    UsersModule,
    ProfilesModule,
    CategoriesModule,
    CardsModule,
    CardPreferencesModule,
    AuthModule,
    SuggestionsModule,
    TranslationsModule,
    TelegramModule,
    RedisSessionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
