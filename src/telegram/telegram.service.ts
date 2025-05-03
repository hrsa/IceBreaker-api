import { InjectBot } from "nestjs-telegraf";
import { Context, Markup, Telegraf } from "telegraf";
import { Injectable, Logger } from '@nestjs/common';
import { UsersService } from "../users/users.service";
import { ProfilesService } from "../profiles/profiles.service";
import { CardsService } from "../cards/cards.service";
import { CategoriesService } from "../categories/categories.service";
import { GetRandomCardDto } from "../cards/dto/get-random-card.dto";
import { Profile } from "../profiles/entities/profile.entity";
import { Category } from "../categories/entities/category.entity";
import { AppLanguage } from "../common/constants/app-language.enum";
import { LanguageUtilsService } from "../common/utils/language-utils.service";
import { I18nService } from 'nestjs-i18n';

@Injectable()
export class TelegramService {
  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    private usersService: UsersService,
    private profilesService: ProfilesService,
    private categoriesService: CategoriesService,
    private cardsService: CardsService,
    private languageUtilsService: LanguageUtilsService,
    private translate: I18nService,
  ) {}
  private readonly logger = new Logger(TelegramService.name);

  async onModuleInit() {
    await this.bot.telegram.setMyCommands([
      { command: "start", description: this.translate.t('telegram.commands.start.description') },
      { command: "help", description: this.translate.t('telegram.commands.help.description') },
      { command: "language", description: this.translate.t('telegram.commands.language.description') },
    ]);
  }

  async sendMessage(chatId: number | string, message: string): Promise<void> {
    await this.bot.telegram.sendMessage(chatId, message);
  }


  async updateOrSendMessage(ctx: Context, text: string, extra?: any) {
    try {
      if (ctx.session.botMessageId) {
        if (!ctx.session.lastMessageText || ctx.session.lastMessageText !== text) {
          try {
            await ctx.telegram.editMessageText(ctx.chat!.id, ctx.session.botMessageId, undefined, text, extra);
            ctx.session.lastMessageText = text;
            return;
          } catch (editError) {
            // Message might have been deleted or is too old to edit
            this.logger.warn("Failed to edit message, sending new one:", editError.message);

            // Clear the botMessageId since it's no longer valid
            ctx.session.botMessageId = undefined;
            ctx.session.lastMessageText = undefined;

            // Send a new message instead
            const sentMsg = await ctx.reply(text, extra);
            if ("message_id" in sentMsg) {
              ctx.session.botMessageId = sentMsg.message_id;
              ctx.session.lastMessageText = text;
            }
            return sentMsg;
          }
        } else {
          console.log("Skipping update - message content is the same");
          return;
        }
      } else {
        const sentMsg = await ctx.reply(text, extra);
        if ("message_id" in sentMsg) {
          ctx.session.botMessageId = sentMsg.message_id;
          ctx.session.lastMessageText = text;
        }
        return sentMsg;
      }
    } catch (error) {
      console.error("Error sending/updating message:", error);
      // Reset message tracking and try one more time
      ctx.session.botMessageId = undefined;
      ctx.session.lastMessageText = undefined;

      try {
        const sentMsg = await ctx.reply(text, extra);
        if ("message_id" in sentMsg) {
          ctx.session.botMessageId = sentMsg.message_id;
          ctx.session.lastMessageText = text;
        }
        return sentMsg;
      } catch (finalError) {
        console.error("Fatal error sending message:", finalError);
        // At this point, there's not much more we can do
      }
    }
  }


  async validateEmail(email: string): Promise<boolean> {
    try {
      await this.usersService.findByEmail(email);
      return true;
    } catch (error) {
      return false;
    }
  }

  async getUserByEmail(email: string) {
    return this.usersService.findByEmail(email);
  }

  async getProfilesForUser(userId: string) {
    return this.profilesService.findAll(userId);
  }

  async getCategoriesForSelection() {
    return this.categoriesService.findAll();
  }

  async createProfile(userId: string, name: string) {
    return this.profilesService.create({ userId, name });
  }

  async getRandomCard(dto: GetRandomCardDto) {
    const result = await this.cardsService.getRandomCard(dto);
    const hasViewedAllCards = await this.cardsService.hasOnlyLovedCardsLeft(dto);
    return {
      cards: result,
      hasViewedAllCards,
    };
  }

  createProfileKeyboard(profiles: Profile[], language?: AppLanguage) {
    const buttons = profiles.map(profile => [Markup.button.callback(profile.name, `profile:${profile.id}`)]);
    buttons.push([Markup.button.callback(this.translate.t('telegram.profile.selection.create_new', {lang: language}), "profile:new")]);
    return Markup.inlineKeyboard(buttons);
  }

  createCategoryKeyboard(categories: Category[], language: AppLanguage, selectedCategoryIds: string[] = []) {
    const buttons = categories.map(category => {
      const isSelected = selectedCategoryIds.includes(category.id);
      let categoryName = this.languageUtilsService.getPropertyByLanguage(category, "name", language);
      if (!categoryName) categoryName = "MISSING TRANSLATION";
      const categoryButtonText = isSelected ? `${categoryName} ✅` : categoryName;
      return [Markup.button.callback(categoryButtonText, `category:${category.id}`)];
    });

    if (selectedCategoryIds.length > 0) {
      buttons.push([Markup.button.callback(this.translate.t('telegram.category.selection.start_game', {lang: language}), "categories:done")]);
    }

    return Markup.inlineKeyboard(buttons);
  }

  createCardActionsKeyboard(language?: AppLanguage) {
    const anotherCard = this.translate.t('telegram.card.actions.another', {lang: language});
    const changeCategories = this.translate.t('telegram.card.actions.change_categories', {lang: language});
    const changeProfile = this.translate.t('telegram.card.actions.change_profile', {lang: language});
    const startOver = this.translate.t('telegram.card.actions.start_over', {lang: language});
    const changeLanguage = this.translate.t('telegram.card.actions.change_language', {lang: language});
    return Markup.inlineKeyboard([
      [Markup.button.callback(anotherCard, "card:another"), Markup.button.callback(changeCategories, "card:change_categories")],
      [Markup.button.callback(changeProfile, "card:change_profile"), Markup.button.callback(startOver, "card:start_over")],
      [Markup.button.callback(changeLanguage, "card:change_language")],
    ]);
  }

  createLanguageSelectionKeyboard(language?: AppLanguage) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(this.translate.t('telegram.language.options.english', {lang: language}), `language:${AppLanguage.ENGLISH}`),
        Markup.button.callback(this.translate.t('telegram.language.options.russian', {lang: language}), `language:${AppLanguage.RUSSIAN}`),
      ],
      [
        Markup.button.callback(this.translate.t('telegram.language.options.french', {lang: language}), `language:${AppLanguage.FRENCH}`),
        Markup.button.callback(this.translate.t('telegram.language.options.italian', {lang: language}), `language:${AppLanguage.ITALIAN}`),
      ],
    ]);
  }
}
