import { Injectable, Logger } from "@nestjs/common";
import { Redis } from "ioredis";
import { ConfigService } from "@nestjs/config";
import { Context, MiddlewareFn } from "telegraf";
import { TelegramSession } from "../telegram/interfaces/telegram-session.interface";
import { UsersService } from "../users/users.service";
import { AppLanguage } from "../common/constants/app-language.enum";
import { OnEvent } from "@nestjs/event-emitter";
import { UserCreditsUpdatedEvent } from "../users/events/user-credits-updated.event";

@Injectable()
export class RedisSessionService {
  private readonly redisClient: Redis;
  private readonly ttl: number;
  private readonly logger = new Logger(RedisSessionService.name);

  constructor(
    private configService: ConfigService,
    private usersService: UsersService
  ) {
    this.redisClient = new Redis({
      host: this.configService.get("REDIS_HOST", "localhost"),
      port: this.configService.get("REDIS_PORT", 6379),
      password: this.configService.get("REDIS_PASSWORD", ""),
      db: this.configService.get("REDIS_DB", 0),
    });

    this.ttl = this.configService.get("SESSION_TTL", 86400 * 30);
  }

  middleware(): MiddlewareFn<Context> {
    return async (ctx, next) => {
      const telegramUser = ctx.callbackQuery?.from || ctx.message?.from;
      const telegramId = telegramUser?.id.toString() || ctx.chat?.id.toString();

      if (!telegramId) {
        this.logger.warn(`Cannot load session for undefined chatId`);
      }

      const session = await this.getSession(telegramId);
      ctx.session = session;

      if (!ctx.session?.language) {
        ctx.session.language = AppLanguage.ENGLISH;
      }

      this.logger.debug(`Loading session for chat ${ctx.chat?.id}: ${JSON.stringify(session)}`);

      if (telegramId && !ctx.session.userId) {
        try {
          const user = await this.usersService.findByTelegramId(telegramId);
          if (user) {
            ctx.session.userId = user.id;
            ctx.session.email = user.email;
            ctx.session.credits = user.credits;
            this.logger.debug(`Found user with Telegram ID: ${telegramId}`);
          }
        } catch (e) {}
        this.logger.warn(`No user found with Telegram ID: ${telegramId}`);
      }

      await next();

      this.logger.debug(`Saving session for chat ${ctx.chat?.id}: ${JSON.stringify(ctx.session)}`);

      if (ctx.session) {
        await this.saveSession(telegramId, ctx.session);
      } else {
        await this.clearSession(telegramId);
      }
    };
  }

  @OnEvent("user.credits.updated")
  async handleDonationReceived(event: UserCreditsUpdatedEvent): Promise<void> {
    const { telegramId, credits } = event;
    if (telegramId) {
      const session = await this.getSession(telegramId);
      if (session) {
        session.credits = credits;
        await this.saveSession(telegramId, session);
      }
    }
  }

  async clearSession(chatId: number | string | undefined): Promise<void> {
    if (!chatId) {
      return;
    }

    const key = `session:${chatId}`;
    await this.redisClient.del(key);
  }

  async getSession(chatId: string | number | undefined): Promise<TelegramSession> {
    if (!chatId) {
      return { language: AppLanguage.ENGLISH } as TelegramSession;
    }
    const key = `session:${chatId}`;
    const sessionData = await this.redisClient.get(key);

    if (sessionData) {
      return JSON.parse(sessionData) as TelegramSession;
    }

    return { language: AppLanguage.ENGLISH } as TelegramSession;
  }

  async saveSession(chatId: string | number | undefined, session: TelegramSession): Promise<void> {
    if (!chatId) {
      this.logger.warn(`Cannot save session for undefined chatId`);
      return;
    }
    const key = `session:${chatId}`;
    await this.redisClient.set(key, JSON.stringify(session), "EX", this.ttl);
  }

  getRedisClient(): Redis {
    return this.redisClient;
  }
}
