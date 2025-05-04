import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { I18nService } from "nestjs-i18n";

@Injectable()
export class SignupNameState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly translate: I18nService
  ) {}

  async handle(ctx: Context): Promise<void> {
    ctx.session.step = "signup-name";

    await this.telegramService.updateOrSendMessage(ctx, this.translate.t("telegram.signup.enter_name", { lang: ctx.session.language }));
  }

  async next(ctx: Context): Promise<void> {
    if (!ctx.message || !("text" in ctx.message)) {
      return;
    }

    const name = ctx.message.text.trim();
    if (ctx.chat) {
      await this.telegramService.safeDeleteMessage(ctx.chat.id, ctx.message.message_id);
    }

    if (name.length < 1) {
      await this.telegramService.updateOrSendMessage(ctx, this.translate.t("telegram.signup.name_empty", { lang: ctx.session.language }));
      return;
    }

    try {
      await this.telegramService.registerNewUser(ctx, name);
    } catch (e) {
      await this.telegramService.updateOrSendMessage(ctx, e.message);
    }
  }
}
