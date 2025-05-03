import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { GetRandomCardDto } from "../../cards/dto/get-random-card.dto";
import { LanguageUtilsService } from "../../common/utils/language-utils.service";
import { I18nService } from "nestjs-i18n";

@Injectable()
export class CardRetrievalState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly languageUtilsService: LanguageUtilsService,
    private readonly translate: I18nService
  ) {}

  async handle(ctx: Context, useExistingCard: boolean = false): Promise<void> {
    await this.getRandomCard(ctx, useExistingCard);
  }

  async next(ctx: Context): Promise<void> {
    // Not needed for this state as it's handled by actions
  }

  async getRandomCard(ctx: Context, useExistingCard: boolean = false): Promise<void> {
    if (!ctx.session.userId || !ctx.session.selectedProfileId || !ctx.session.selectedCategoryIds) {
      return;
    }
    try {
      let card;
      let hasViewedAllCards = false;

      if (useExistingCard && ctx.session.card) {
        card = ctx.session.card;
      } else {
        const dto: GetRandomCardDto = {
          profileId: ctx.session.selectedProfileId,
          categoryIds: ctx.session.selectedCategoryIds,
          limit: 1,
          includeArchived: false,
          includeLoved: false,
        };

        const { cards, hasViewedAllCards: allViewed } = await this.telegramService.getRandomCard(dto);

        if (cards.length === 0) {
          await this.telegramService.updateOrSendMessage(
            ctx,
            this.translate.t("telegram.card.no_cards", { lang: ctx.session.language }),
            this.telegramService.createCardActionsKeyboard()
          );
          return;
        }

        card = cards[0];
        hasViewedAllCards = allViewed;

        ctx.session.card = card;
      }

      const language = ctx.session.language;

      let question = this.languageUtilsService.getPropertyByLanguage(card, "question", language);
      let cardMessage = `<blockquote><b>${question}</b></blockquote>\n\n`;

      if (card.category) {
        const categoryName = this.languageUtilsService.getPropertyByLanguage(card.category, "name", language);
        if (categoryName) {
          cardMessage += `<code>${this.translate.t("telegram.card.category_info", {
            args: { categoryName: categoryName },
            lang: language,
          })}</code>`;
        }
      }

      if (hasViewedAllCards) {
        cardMessage += `\n\n${this.translate.t("telegram.card.all_viewed", { lang: language })}`;
      }

      await this.telegramService.updateOrSendMessage(ctx, cardMessage, {
        ...this.telegramService.createCardActionsKeyboard(language),
        parse_mode: "HTML",
      });
    } catch (error) {
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("card.error", { args: { message: error.message }, lang: ctx.session.language })
      );
    }
  }
}
