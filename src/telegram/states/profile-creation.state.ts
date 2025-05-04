import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { I18nService } from "nestjs-i18n";

@Injectable()
export class ProfileCreationState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly translate: I18nService
  ) {}

  async handle(ctx: Context): Promise<void> {
    ctx.session.step = "profile-creation";
    await this.telegramService.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.profile.creation.prompt", { lang: ctx.session.language })
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

    const profileName = ctx.message.text.trim();

    if (profileName.length < 1 || profileName.length > 50) {
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.profile.creation.length_error", { lang: ctx.session.language })
      );
      return;
    }

    try {
      if (ctx.chat) {
        await this.telegramService.safeDeleteMessage(ctx.chat.id, ctx.message.message_id);
      }

      const profile = await this.telegramService.createProfile(ctx.session.userId!, profileName);

      ctx.session.selectedProfileId = profile.id;
      ctx.session.step = "category-selection";
      ctx.session.selectedCategoryIds = [];

      const categories = await this.telegramService.getCategoriesForSelection();

      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.profile.creation.success", {
          args: { profileName: profileName },
          lang: ctx.session.language,
        }),
        this.telegramService.createCategoryKeyboard(categories, ctx.session.language)
      );
    } catch (error) {
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.profile.creation.error", {
          args: { message: error.message },
          lang: ctx.session.language,
        })
      );
    }
  }
}
