import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { GetRandomCardDto } from "../../cards/dto/get-random-card.dto";
import { LanguageUtilsService } from "../../common/utils/language-utils.service";
import { I18nService } from "nestjs-i18n";
import { Card } from '../../cards/entities/card.entity';
import { AppLanguage } from '../../common/constants/app-language.enum';
import { CardStatus } from '../../card-preferences/entitites/card-preference.entity';

@Injectable()
export class CardRetrievalState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly languageUtilsService: LanguageUtilsService,
    private readonly translate: I18nService
  ) {}

  async handle(ctx: Context, useExistingCard: boolean = false): Promise<void> {
    if (ctx.session.includeArchived === undefined) {
      ctx.session.includeArchived = false;
    }
    if (ctx.session.includeLoved === undefined) {
      ctx.session.includeLoved = true;
    }
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
          categoryIds: ctx.session.selectedCategoryIds ?? [],
          limit: 2,
          includeArchived: ctx.session.includeArchived ?? false,
          includeLoved: ctx.session.includeLoved ?? true,
        };

        const { cards, hasViewedAllCards: allViewed } = await this.telegramService.getRandomCard(dto);

        if (cards.length === 0) {
          await this.telegramService.updateOrSendMessage(
            ctx,
            this.translate.t("telegram.card.no_cards", { lang: ctx.session.language }),
            this.telegramService.createCardActionsKeyboard(ctx)
          );
          return;
        }

        card = cards[0];
        hasViewedAllCards = allViewed;

        ctx.session.previousCard = ctx.session.card;
        ctx.session.card = card;

        const currentCardInNewCards = cards.some(c => c.id === ctx.session.previousCard?.id);
        const cardIsSameAsPrevious = card.id === ctx.session.previousCard?.id;

        if (cardIsSameAsPrevious && cards.length >= 2) {
          card = cards[1];
        }

        if (currentCardInNewCards && cards.length < 2) {
          hasViewedAllCards = true;
        }
      }

      const language = ctx.session.language;
      const cardStatusText = this.generateCardStatusText(card, language);

      let question = this.languageUtilsService.getPropertyByLanguage(card, "question", language);
      let cardMessage = `<pre>\n</pre>${cardStatusText}\n<blockquote><b>\n${question}\n\n\n</b></blockquote>`;

      if (card.category) {
        const categoryName = this.languageUtilsService.getPropertyByLanguage(card.category, "name", language);
        if (categoryName) {
          cardMessage += `\n\n<code>${this.translate.t("telegram.card.category_info", {
            args: { categoryName: categoryName },
            lang: language,
          })}</code>`;
        }
      }

      if (useExistingCard) {
        cardMessage += `  `;
      }

      if (hasViewedAllCards) {
        cardMessage += `\n\n${this.translate.t("telegram.card.all_viewed", { lang: language })}`;
      }

      await this.telegramService.updateOrSendMessage(ctx, cardMessage, {
        ...this.telegramService.createCardActionsKeyboard(ctx),
        parse_mode: "HTML",
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("No cards found matching the criteria")) {
        await this.telegramService.updateOrSendMessage(
          ctx,
          this.translate.t("telegram.card.all_viewed", { lang: ctx.session.language }),
          this.telegramService.createCardActionsKeyboard(ctx)
        );
        return;
      }
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.card.error", { args: { message: error.message }, lang: ctx.session.language }),
        this.telegramService.createCardActionsKeyboard(ctx)
      );
    }
  }

  generateCardStatusText(card: Card, language: AppLanguage): string {
    const status = card.cardPreference?.status

    switch (status) {
      case CardStatus.LOVED:
        return this.translate.t("telegram.card.status.loved", { lang: language });
      case CardStatus.ARCHIVED:
        return this.translate.t("telegram.card.status.archived", { lang: language });
      default:
        return "";
    }
  }
}
