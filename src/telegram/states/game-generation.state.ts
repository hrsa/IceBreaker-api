import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { I18nService } from "nestjs-i18n";

@Injectable()
export class GameGenerationState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly translate: I18nService
  ) {}

  async handle(ctx: Context): Promise<void> {
    await this.telegramService.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.generate.rules", { lang: ctx.session.language }),
      {parse_mode: "HTML"}
    );
  }

  async next(ctx: Context): Promise<void> {
    if (!ctx.message || !("text" in ctx.message)) {
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.profile.creation.invalid", { lang: ctx.session.language })
      );
      return;
    }

    const gameDescription = ctx.message.text.trim();

    if (ctx.chat) {
      await this.telegramService.safeDeleteMessage(ctx.chat.id, ctx.message.message_id);
    }
    await this.telegramService.generateNewGame(ctx, gameDescription);
  }
}
