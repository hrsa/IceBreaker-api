import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { InjectBot } from "nestjs-telegraf";
import { Context, Telegraf } from "telegraf";
import { RedisSessionService } from "../redis/redis-session.middleware";
import { Message } from "telegraf/typings/core/types/typegram";
import { TelegramSession } from "./interfaces/telegram-session.interface";
import { Job } from "bullmq";

@Processor("telegram-messages")
export class TelegramMessageProcessor extends WorkerHost {
  private readonly logger = new Logger(TelegramMessageProcessor.name);

  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    private readonly redisSessionService: RedisSessionService
  ) {
    super();
  }

  trackMessage(session: TelegramSession, message: Message.TextMessage) {
    if (!session.botMessageIds) {
      session.botMessageIds = [];
    }
    session.botMessageIds.push(message.message_id);
    session.botMessageId = message.message_id;
    session.lastMessageText = message.text;
  }

  async process(job: Job<{ telegramId: string | number; text: string; extra?: any }>) {
    switch (job.name) {
      case "send-message":
        const { telegramId, text, extra } = job.data;
        this.logger.debug(`Processing message job for ${telegramId}: ${text}`);

        try {
          const session = await this.redisSessionService.getSession(telegramId);
          const message = await this.bot.telegram.sendMessage(telegramId, text, extra);
          this.trackMessage(session, message);
          await this.redisSessionService.saveSession(telegramId, session);
          return { success: true, messageId: message.message_id };
        } catch (error) {
          this.logger.error(`Failed to send message to ${telegramId}: ${error.message}`);
          throw error;
        }
    }
  }
}
