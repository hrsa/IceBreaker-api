import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { I18nModule, QueryResolver, AcceptLanguageResolver, HeaderResolver } from 'nestjs-i18n';
import { join } from 'path';
import { AppController } from '../../src/app.controller';
import { AppService } from '../../src/app.service';
import { UsersModule } from '../../src/users/users.module';
import { ProfilesModule } from '../../src/profiles/profiles.module';
import { CategoriesModule } from '../../src/categories/categories.module';
import { CardsModule } from '../../src/cards/cards.module';
import { CardPreferencesModule } from '../../src/card-preferences/card-preferences.module';
import { AuthModule } from '../../src/auth/auth.module';
import { SuggestionsModule } from '../../src/suggestions/suggestions.module';
import { AIModule } from '../../src/ai/ai.module';
import { MockTelegramModule } from './mocks/mock-telegram-module';
import { RedisSessionModule } from '../../src/redis-session/redis-session.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WebhooksModule } from '../../src/webhooks/webhooks.module';
import { testDataSourceOptions } from './test-database.config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env.test',
    }),
    TypeOrmModule.forRoot(testDataSourceOptions),
    I18nModule.forRootAsync({
      useFactory: () => ({
        fallbackLanguage: 'en',
        loaderOptions: {
          path: join(__dirname, '../../src/i18n/'),
        },
      }),
      resolvers: [
        { use: QueryResolver, options: ['lang'] },
        AcceptLanguageResolver,
        new HeaderResolver(['x-lang'])
      ],
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
    MockTelegramModule,
    RedisSessionModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class TestAppModule {}