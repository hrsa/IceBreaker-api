import { Injectable } from "@nestjs/common";
import { Context, Markup } from 'telegraf';
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { I18nService } from "nestjs-i18n";
import { CreateSuggestionDto } from "src/suggestions/dto/create-suggestion.dto";

@Injectable()
export class SuggestionCreationState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly translate: I18nService
  ) {}

  async handle(ctx: Context): Promise<void> {
    ctx.session.step = "suggestion-creation";

    await this.telegramService.deleteUserMessage(ctx);

    if (!ctx.session.userId) {
      await this.telegramService.replyAndSave(ctx, this.translate.t("telegram.suggestion.unauthorized", { lang: ctx.session.language }));
      return;
    }

    await this.telegramService.replyAndSave(ctx, this.translate.t("telegram.suggestion.prompt", { lang: ctx.session.language }));
  }

  async next(ctx: Context): Promise<void> {
    if (!ctx.message || !("text" in ctx.message)) {
      return;
    }

    if (!ctx.session.userId) {
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.suggestion.unauthorized", { lang: ctx.session.language })
      );
      return;
    }

    const createSuggestionDto = new CreateSuggestionDto({ userId: ctx.session.userId, question: ctx.message.text });

    await this.telegramService.createSuggestion(createSuggestionDto);

    await ctx.telegram.deleteMessage(ctx.message.chat.id, ctx.message.message_id);

    const backToTheGameButton = Markup.inlineKeyboard([
      Markup.button.callback(this.translate.t("telegram.buttons.back_to_the_game", { lang: ctx.session.language }), "card:back_to_the_game")
    ])

    await this.telegramService.updateOrSendMessage(ctx, this.translate.t("telegram.suggestion.success", { lang: ctx.session.language }), backToTheGameButton);

    ctx.session.step = "card-retrieval";
  }
}
