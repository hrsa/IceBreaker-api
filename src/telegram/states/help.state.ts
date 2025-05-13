import { Injectable } from "@nestjs/common";
import { Context, Markup } from "telegraf";
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { I18nService } from "nestjs-i18n";

@Injectable()
export class HelpState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly translate: I18nService
  ) {}

  async handle(ctx: Context): Promise<void> {
    await this.telegramService.deleteUserMessage(ctx);
    if (ctx.session.credits && ctx.session.credits > 0) {
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.help.message_for_supporters", { lang: ctx.session.language }),
        Markup.inlineKeyboard([
          [
            Markup.button.callback(
              this.translate.t("telegram.card.actions.change_language", { lang: ctx.session.language }),
              "card:change_language"
            ),
          ],
          [Markup.button.callback(this.translate.t("telegram.buttons.generate", { lang: ctx.session.language }), "game:generate")],
        ])
      );
      return;
    }
    await this.telegramService.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.help.message", { lang: ctx.session.language }),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            this.translate.t("telegram.card.actions.change_language", { lang: ctx.session.language }),
            "card:change_language"
          ),
        ],
        [this.telegramService.getBuyCoffeeButton(ctx.session)],
      ])
    );
  }

  async next(ctx: Context): Promise<void> {}
}
