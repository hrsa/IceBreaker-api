import { Injectable } from '@nestjs/common';
import { Context } from 'telegraf';
import { TelegramService } from '../telegram.service';
import { BotState } from './base.state';
import { AppLanguage } from '../../common/constants/app-language.enum';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class AuthenticationState implements BotState {
  constructor(private readonly telegramService: TelegramService, private readonly translate: I18nService) {}

  async handle(ctx: Context): Promise<void> {
    if (!ctx.session.language) {
      ctx.session = { language: AppLanguage.ENGLISH };
    }

    ctx.session.step = 'authentication';
    await this.telegramService.updateOrSendMessage(
      ctx,
      this.translate.t('telegram.authentication.welcome', {lang: ctx.session.language})
    );
  }

  async next(ctx: Context): Promise<void> {
    const message = ctx.message;
    if (!message) return;

    const email = "text" in message ? message.text : "";
    const isValidEmail = await this.telegramService.validateEmail(email);

    if (isValidEmail) {
      const user = await this.telegramService.getUserByEmail(email);
      ctx.session.userId = user.id;
      ctx.session.email = email;
      ctx.session.step = "profile-selection";

      if (ctx.chat) {
        await ctx.telegram.deleteMessage(ctx.chat.id, ctx.message.message_id);
      }

      const profiles = await this.telegramService.getProfilesForUser(user.id);

      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t('telegram.authentication.success', {args: {name: user.name}, lang: ctx.session.language}),
        this.telegramService.createProfileKeyboard(profiles)
      );
    } else {
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t('telegram.authentication.email_not_found', {lang: ctx.session.language}),
      );
    }
  }
}