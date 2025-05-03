import { Injectable, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { Context, MiddlewareFn } from 'telegraf';
import { TelegramSession } from '../telegram/interfaces/telegram-session.interface';

@Injectable()
export class RedisSessionService {
  private redisClient: Redis;
  private readonly ttl: number;
  private readonly logger = new Logger(RedisSessionService.name);

  constructor(private configService: ConfigService) {
    this.redisClient = new Redis({
      host: this.configService.get('REDIS_HOST', 'localhost'),
      port: this.configService.get('REDIS_PORT', 6379),
      password: this.configService.get('REDIS_PASSWORD', ''),
      db: this.configService.get('REDIS_DB', 0),
    });

    this.ttl = this.configService.get('SESSION_TTL', 86400);
  }

  middleware(): MiddlewareFn<Context> {
    return async (ctx, next) => {
      const key = `session:${ctx.chat?.id}`;
      const sessionData = await this.redisClient.get(key);

      const session = sessionData ? JSON.parse(sessionData) : {} as TelegramSession;
      ctx.session = session;

      this.logger.debug(`Loading session for chat ${ctx.chat?.id}: ${JSON.stringify(session)}`);


      await next();

      this.logger.debug(`Saving session for chat ${ctx.chat?.id}: ${JSON.stringify(ctx.session)}`);


      if (ctx.session) {
        await this.redisClient.set(
          key,
          JSON.stringify(ctx.session),
          'EX',
          this.ttl
        );
      } else {
        await this.redisClient.del(key);
      }
    };
  }

  async clearSession(chatId: number): Promise<void> {
    const key = `session:${chatId}`;
    await this.redisClient.del(key);
  }
}