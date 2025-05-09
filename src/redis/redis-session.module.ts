import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisSessionService } from './redis-session.middleware';
import { UsersModule } from '../users/users.module';
import { TelegramModule } from '../telegram/telegram.module';
import { TelegramService } from '../telegram/telegram.service';

@Module({
  imports: [ConfigModule, UsersModule],
  providers: [RedisSessionService],
  exports: [RedisSessionService],
})
export class RedisSessionModule {}