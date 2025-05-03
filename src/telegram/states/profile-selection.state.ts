import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { I18nService } from "nestjs-i18n";

@Injectable()
export class ProfileSelectionState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly translate: I18nService
  ) {}

  async handle(ctx: Context): Promise<void> {
    if (!ctx.session.userId) return;
    ctx.session.step = "profile-selection";
    const profiles = await this.telegramService.getProfilesForUser(ctx.session.userId);

    await this.telegramService.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.profile.selection.prompt", { lang: ctx.session.language }),
      this.telegramService.createProfileKeyboard(profiles, ctx.session.language)
    );
  }

  async next(ctx: Context): Promise<void> {
    if (!ctx.match) {
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.profile.selection.invalid", { lang: ctx.session.language })
      );
      return;
    }

    ctx.session.selectedProfileId = ctx.match[1];
    ctx.session.step = "category-selection";
    ctx.session.selectedCategoryIds = [];

    const categories = await this.telegramService.getCategoriesForSelection();

    await ctx.editMessageText(
      this.translate.t("telegram.category.selection.prompt", { lang: ctx.session.language }),
      this.telegramService.createCategoryKeyboard(categories, ctx.session.language)
    );
  }
}