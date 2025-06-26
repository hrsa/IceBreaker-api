import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { I18nService } from "nestjs-i18n";

@Injectable()
export class BroadcastState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly translate: I18nService
  ) {}

  async handle(ctx: Context): Promise<void> {
    ctx.session.step = "broadcast";
    await this.telegramService.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.broadcast.question", { lang: ctx.session.language })
    );
  }

  async next(ctx: Context): Promise<void> {
    if (!ctx.message || !("text" in ctx.message)) {
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.broadcast.error", {
          args: { error: "no text in message" },
          lang: ctx.session.language,
        })
      );
      return;
    }

    const broadcastMessage = ctx.message.text.trim();

    try {
      if (ctx.chat) {
        await this.telegramService.safeDeleteMessage(ctx.chat.id, ctx.message.message_id);
      }
      await this.telegramService.updateOrSendMessage(
        ctx,
        "✅✅✅"
      );
      await this.telegramService.broadcastMessage(ctx, broadcastMessage);
      ctx.session.step = "card-retrieval";
    } catch (error) {
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.broadcast.error", {
          args: { error: error.message },
          lang: ctx.session.language,
        })
      );
    }
  }
}
