import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import Redis from "ioredis";
import { ConfigService } from "@nestjs/config";
import { PubSubEvent } from "./interfaces/pub-sub-event";
import { TelegramMessageEvent } from "../telegram/events/telegram-message.event";
import { TelegrafExtra } from "../telegram/types";
import { getErrorMessage } from "../common/utils/error.utils";

type EventHandler = (data: unknown) => void | Promise<void>;

@Injectable()
export class RedisPubSubService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisPubSubService.name);
  private publisher: Redis;
  private subscriber: Redis;
  private eventHandlers = new Map<string, EventHandler>();
  private subscribedChannels = new Set<string>();

  constructor(private readonly configService: ConfigService) {
    const redisConfig = {
      host: this.configService.getOrThrow<string>("REDIS_HOST"),
      port: this.configService.getOrThrow<number>("REDIS_PORT"),
      password: this.configService.getOrThrow<string>("REDIS_PASSWORD"),
      db: this.configService.getOrThrow<number>("REDIS_DB", 0),
    };
    this.publisher = new Redis(redisConfig);
    this.subscriber = new Redis(redisConfig);
  }

  onModuleInit() {
    this.subscriber.on("message", (channel: string, message: string) => {
      this.handleMessage(channel, message).catch(error => {
        this.logger.error(`Failed to handle message from channel ${channel}: ${getErrorMessage(error)}`);
      });
    });
    this.logger.log("Redis pub/sub service initialized");
  }

  onModuleDestroy() {
    this.publisher.disconnect();
    this.subscriber.disconnect();
    this.logger.log("Redis pub/sub service destroyed");
  }

  async publish(channel: string, eventType: string, data: unknown): Promise<void> {
    const event: PubSubEvent = {
      type: eventType,
      data,
      timestamp: Date.now(),
    };

    try {
      await this.publisher.publish(channel, JSON.stringify(event));
      this.logger.debug(`Published event ${eventType} to channel ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to publish event ${eventType} to channel ${channel}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  subscribe<T>(channel: string, eventType: string, handler: (data: T) => Promise<void>): void {
    const key = `${channel}:${eventType}`;
    this.eventHandlers.set(key, data => handler(data as T));

    if (!this.subscribedChannels.has(channel)) {
      void this.subscriber.subscribe(channel);
      this.subscribedChannels.add(channel);
      this.logger.log(`Subscribed to Redis channel: ${channel}`);
    }

    this.logger.log(`Registered handler for ${eventType} events on channel ${channel}`);
  }

  async handleMessage(channel: string, message: string): Promise<void> {
    try {
      const event = JSON.parse(message) as PubSubEvent;
      const key = `${channel}:${event.type}`;
      const handler = this.eventHandlers.get(key);

      if (handler) {
        await handler(event.data);
        this.logger.debug(`Handled event ${event.type} from channel ${channel}`);
      } else {
        this.logger.warn(`No handler for event ${event.type} from channel ${channel}`);
      }
    } catch (error) {
      this.logger.error(`Failed to handle event from channel ${channel}: ${getErrorMessage(error)}`);
      throw error;
    }
  }

  async adminTelegramNotification(messageText: string, extra?: TelegrafExtra): Promise<void> {
    const event = new TelegramMessageEvent(this.configService.getOrThrow<string>("ADMIN_TELEGRAM_ID"), messageText, extra);
    await this.publish("app-events", "telegram.message", event);
  }
}
