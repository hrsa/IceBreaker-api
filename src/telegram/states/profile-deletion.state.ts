import { Injectable } from "@nestjs/common";
import { Context, Markup } from "telegraf";
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { I18nService } from "nestjs-i18n";

@Injectable()
export class ProfileDeletionState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly translate: I18nService
  ) {}

  async handle(ctx: Context): Promise<void> {
    if (!ctx.session.userId) return;
    ctx.session.step = "profile-deletion";
    const profiles = await this.telegramService.getProfilesForUser(ctx.session.userId);

    await this.telegramService.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.profile.selection.prompt", { lang: ctx.session.language }),
      this.telegramService.createProfileKeyboard(profiles, ctx.session.language, true)
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

    const profileId = ctx.match[1];

    const profileName = await this.telegramService.getProfileName(profileId);

    await ctx.editMessageText(
      this.translate.t("telegram.profile.deletion.prompt", { args: { profileName }, lang: ctx.session.language }),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            this.translate.t("telegram.profile.deletion.yes", {
              args: { profileName },
              lang: ctx.session.language,
            }),
            "profile:delete:" + profileId
          ),
        ],
        [
          Markup.button.callback(
            this.translate.t("telegram.profile.deletion.no", {
              args: { profileName },
              lang: ctx.session.language,
            }),
            "profile:delete:cancel"
          ),
        ],
      ])
    );
  }
}
