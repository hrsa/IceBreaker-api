import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { TelegramMessageEvent } from "./telegram/events/telegram-message.event";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class AppService {
  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2
  ) {}

  getHello(): string {
    return "Welcome to IceMelter API!";
  }

  logCoffee(coffee: string): void {
    const buyer = Buffer.from(coffee, "base64").toString("ascii");
    this.eventEmitter.emit(
      "telegram.message",
      new TelegramMessageEvent(this.configService.getOrThrow<string>("ADMIN_TELEGRAM_ID"), `🎊${buyer} is buying you a coffee!🎊`)
    );
  }
}
