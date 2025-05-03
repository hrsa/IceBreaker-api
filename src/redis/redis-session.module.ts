import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RedisSessionService } from './redis-session.middleware';

@Module({
  imports: [ConfigModule],
  providers: [RedisSessionService],
  exports: [RedisSessionService],
})
export class RedisSessionModule {}