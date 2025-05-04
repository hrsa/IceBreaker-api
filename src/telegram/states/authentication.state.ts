import { Injectable } from "@nestjs/common";
import { Context, Markup } from "telegraf";
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { I18nService } from "nestjs-i18n";

@Injectable()
export class AuthenticationState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly translate: I18nService
  ) {}

  async handle(ctx: Context): Promise<void> {
    ctx.session.step = "authentication";
    const signupButton =
      Markup.button.callback(this.translate.t("telegram.buttons.sign_up", { lang: ctx.session.language }), "signup:email")
    ;
    const changeLanguageButton = Markup.button.callback(
      this.translate.t("telegram.card.actions.change_language", { lang: ctx.session.language }),
      "card:change_language"
    );
    await this.telegramService.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.authentication.welcome", { lang: ctx.session.language }),
      Markup.inlineKeyboard([[signupButton], [changeLanguageButton]])
    );
  }

  async next(ctx: Context): Promise<void> {
    const message = ctx.message;
    if (!message) return;

    const secretPhrase = "text" in message ? message.text : "";
    await this.telegramService.deleteUserMessage(ctx);
    try {
      await this.telegramService.authenticateBySecretPhrase(ctx, secretPhrase);
    } catch (e) {
      await this.telegramService.updateOrSendMessage(ctx, e.message);
    }
  }
}
