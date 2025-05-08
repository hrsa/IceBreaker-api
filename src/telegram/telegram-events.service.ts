import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { TelegramService } from './telegram.service';
import { InjectBot } from 'nestjs-telegraf';
import { Context, Telegraf } from 'telegraf';
import { TelegramMessageEvent } from './events/telegram-message.event';
import { RedisSessionService } from '../redis/redis-session.middleware';

@Injectable()
export class TelegramEventsService {
  private readonly logger = new Logger(TelegramEventsService.name);

  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    private telegramService: TelegramService,
    private redisSessionService: RedisSessionService
  ) {}

  @OnEvent('telegram.message')
  async handleTelegramMessage(event: TelegramMessageEvent) {
    this.logger.debug(`Received telegram.message event: ${JSON.stringify(event)}`);

    const { telegramId, messageText, extra } = event;

    try {
      const session = await this.redisSessionService.getSession(telegramId);

      const sentMessage = await this.bot.telegram.sendMessage(telegramId, messageText, extra);

      if (sentMessage && sentMessage.message_id) {
        if (!session.botMessageIds) {
          session.botMessageIds = [];
        }
        session.botMessageIds.push(sentMessage.message_id);
        session.botMessageId = sentMessage.message_id;
        await this.redisSessionService.saveSession(telegramId, session);
      }

      this.logger.debug(`Successfully sent message to Telegram ID ${telegramId}`);
    } catch (error) {
      this.logger.error(`Failed to send message to Telegram ID ${telegramId}: ${error.message}`);
    }
  }
}