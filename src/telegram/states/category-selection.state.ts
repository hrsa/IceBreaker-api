import { Injectable } from '@nestjs/common';
import { Context } from 'telegraf';
import { TelegramService } from '../telegram.service';
import { BotState } from './base.state';
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class CategorySelectionState implements BotState {
  constructor(private readonly telegramService: TelegramService, private readonly translate: I18nService) {}

  async handle(ctx: Context): Promise<void> {
    if (!ctx.session.selectedProfileId) return;

    const categories = await this.telegramService.getCategoriesForSelection();

    await this.telegramService.updateOrSendMessage(
      ctx,
      this.translate.t('telegram.category.selection.prompt', {lang: ctx.session.language}),
      this.telegramService.createCategoryKeyboard(
        categories,
        ctx.session.language,
        ctx.session.selectedCategoryIds || []
      )
    );
  }

  async next(ctx: Context): Promise<void> {
    if (!ctx.match) {
      await this.telegramService.updateOrSendMessage(ctx, this.translate.t('telegram.category.selection.invalid', {lang: ctx.session.language}));
      return;
    }

    const categoryId = ctx.match[1];

    if (!ctx.session.selectedCategoryIds) {
      ctx.session.selectedCategoryIds = [];
    }

    if (ctx.session.selectedCategoryIds.includes(categoryId)) {
      ctx.session.selectedCategoryIds = ctx.session.selectedCategoryIds.filter(id => id !== categoryId);
    } else {
      ctx.session.selectedCategoryIds.push(categoryId);
    }

    const categories = await this.telegramService.getCategoriesForSelection();

    const selectedText = this.translate.t('telegram.category.selection.selected_count', {args: {count: ctx.session.selectedCategoryIds.length}, lang: ctx.session.language})

    await ctx.editMessageText(
      `${this.translate.t('telegram.category.selection.prompt', {lang : ctx.session.language})}\n\n${selectedText}`,
      this.telegramService.createCategoryKeyboard(
        categories,
        ctx.session.language,
        ctx.session.selectedCategoryIds
      )
    );
  }

  async complete(ctx: Context): Promise<void> {
    if (!ctx.session.selectedCategoryIds || !ctx.session.selectedCategoryIds.length) {
      await this.telegramService.updateOrSendMessage(ctx, this.translate.t('telegram.category.selection.select_at_least_one', {lang: ctx.session.language}));
      return;
    }

    ctx.session.step = "card-retrieval";
  }
}