import { InjectBot } from "nestjs-telegraf";
import { Context, Markup, Telegraf } from "telegraf";
import { Injectable, Logger } from "@nestjs/common";
import { UsersService } from "../users/users.service";
import { ProfilesService } from "../profiles/profiles.service";
import { CardsService } from "../cards/cards.service";
import { CategoriesService } from "../categories/categories.service";
import { GetRandomCardDto } from "../cards/dto/get-random-card.dto";
import { Profile } from "../profiles/entities/profile.entity";
import { Category } from "../categories/entities/category.entity";
import { AppLanguage } from "../common/constants/app-language.enum";
import { LanguageUtilsService } from "../common/utils/language-utils.service";
import { I18nService } from "nestjs-i18n";
import { CreateSuggestionDto } from "../suggestions/dto/create-suggestion.dto";
import { SuggestionsService } from "../suggestions/suggestions.service";

@Injectable()
export class TelegramService {
  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    private usersService: UsersService,
    private profilesService: ProfilesService,
    private categoriesService: CategoriesService,
    private cardsService: CardsService,
    private suggestionsService: SuggestionsService,
    private languageUtilsService: LanguageUtilsService,
    private translate: I18nService
  ) {}

  private readonly logger = new Logger(TelegramService.name);

  async onModuleInit() {
    await this.bot.telegram.setMyCommands([
      { command: "start", description: this.translate.t("telegram.commands.start.description") },
      { command: "help", description: this.translate.t("telegram.commands.help.description") },
      { command: "language", description: this.translate.t("telegram.commands.language.description") },
      { command: "suggest", description: this.translate.t("telegram.commands.suggest.description") },
    ]);
  }

  private initMessageIds(ctx: Context): void {
    if (!ctx.session.botMessageIds) {
      ctx.session.botMessageIds = [];
    }
  }

  private trackMessage(ctx: Context, messageId: number, text: string): void {
    this.initMessageIds(ctx);
    ctx.session.botMessageIds!.push(messageId);
    ctx.session.botMessageId = messageId;
    ctx.session.lastMessageText = text;
  }

  private resetMessageTracking(ctx: Context): void {
    ctx.session.botMessageIds = [];
    ctx.session.botMessageId = undefined;
    ctx.session.lastMessageText = undefined;
  }

  private async safeDeleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
    try {
      await this.bot.telegram.deleteMessage(chatId, messageId);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting message ${messageId}:`, error);
      return false;
    }
  }

  async replyAndSave(ctx: Context, text: string, extra?: any) {
    const sentMsg = await ctx.reply(text, extra);
    if ("message_id" in sentMsg) {
      this.trackMessage(ctx, sentMsg.message_id, text);
    }
  }

  async deleteUserMessage(ctx: Context) {
    if (ctx.message) {
      await this.safeDeleteMessage(ctx.message.chat.id, ctx.message.message_id);
    }
  }

  async deleteBotMessage(ctx: Context) {
    if (ctx.chat && ctx.session.botMessageId) {
      await this.safeDeleteMessage(ctx.chat.id, ctx.session.botMessageId);
      ctx.session.botMessageId = undefined;
      ctx.session.lastMessageText = undefined;
    }
  }

  async updateOrSendMessage(ctx: Context, text: string, extra?: any) {
    this.initMessageIds(ctx);
    try {
      if (await this.tryUpdateExistingMessage(ctx, text, extra)) {
        return;
      }

      return await this.sendNewMessage(ctx, text, extra);
    } catch (error) {
      this.logger.error("Error sending/updating message:", error);
      return await this.recoverAndSendMessage(ctx, text, extra);
    }
  }

  private async tryUpdateExistingMessage(ctx: Context, text: string, extra?: any): Promise<boolean> {
    if (!ctx.session.botMessageIds) {
      this.logger.debug("Skipping update - no message ids");
      return false;
    }

    if (ctx.session.botMessageIds && ctx.session.botMessageIds.length === 0) {
      return false;
    }

    if (ctx.session.lastMessageText === text) {
      this.logger.debug("Skipping update - message content is the same");
      return true;
    }

    const latestMessageId = ctx.session.botMessageIds[ctx.session.botMessageIds.length - 1];

    try {
      await ctx.telegram.editMessageText(ctx.chat!.id, latestMessageId, undefined, text, extra);
      ctx.session.lastMessageText = text;

      if (ctx.session.botMessageIds.length > 1) {
        await this.deleteOldMessages(ctx);
      }

      return true;
    } catch (error) {
      this.logger.error("Error editing message:", error);
      return false;
    }
  }

  private async sendNewMessage(ctx: Context, text: string, extra?: any): Promise<any> {
    const sentMsg = await ctx.reply(text, extra);

    if ("message_id" in sentMsg) {
      this.trackMessage(ctx, sentMsg.message_id, text);

      if (ctx.session.botMessageIds && ctx.session.botMessageIds.length > 1) {
        await this.deleteOldMessages(ctx);
      }
    }

    return sentMsg;
  }

  private async recoverAndSendMessage(ctx: Context, text: string, extra?: any): Promise<any> {
    this.resetMessageTracking(ctx);

    try {
      const sentMsg = await ctx.reply(text, extra);

      if ("message_id" in sentMsg) {
        this.trackMessage(ctx, sentMsg.message_id, text);
      }

      return sentMsg;
    } catch (finalError) {
      this.logger.error("Fatal error sending message:", finalError);
      return null;
    }
  }

  async deleteOldMessages(ctx: Context) {
    if (!ctx.session.botMessageIds || ctx.session.botMessageIds.length <= 1) {
      return;
    }

    const messagesToDelete = ctx.session.botMessageIds.slice(0, -1);

    for (const messageId of messagesToDelete) {
      try {
        await ctx.telegram.deleteMessage(ctx.chat!.id, messageId);
      } catch (error) {
        console.error(`Error deleting message ${messageId}:`, error);
      }
    }
    ctx.session.botMessageIds = ctx.session.botMessageIds.slice(-1);
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

  async createSuggestion(createSuggestionDto: CreateSuggestionDto) {
    return this.suggestionsService.create(createSuggestionDto);
  }

  createProfileKeyboard(profiles: Profile[], language?: AppLanguage) {
    const buttons = profiles.map(profile => [Markup.button.callback(profile.name, `profile:${profile.id}`)]);
    buttons.push([Markup.button.callback(this.translate.t("telegram.profile.selection.create_new", { lang: language }), "profile:new")]);
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
      buttons.push([
        Markup.button.callback(this.translate.t("telegram.category.selection.start_game", { lang: language }), "categories:done"),
      ]);
    }

    return Markup.inlineKeyboard(buttons);
  }

  createCardActionsKeyboard(language?: AppLanguage) {
    const anotherCard = this.translate.t("telegram.card.actions.another", { lang: language });
    const changeCategories = this.translate.t("telegram.card.actions.change_categories", { lang: language });
    const changeProfile = this.translate.t("telegram.card.actions.change_profile", { lang: language });
    const startOver = this.translate.t("telegram.card.actions.start_over", { lang: language });
    const changeLanguage = this.translate.t("telegram.card.actions.change_language", { lang: language });
    return Markup.inlineKeyboard([
      [Markup.button.callback(anotherCard, "card:another"), Markup.button.callback(changeCategories, "card:change_categories")],
      [Markup.button.callback(changeProfile, "card:change_profile"), Markup.button.callback(startOver, "card:start_over")],
      [Markup.button.callback(changeLanguage, "card:change_language")],
    ]);
  }

  createLanguageSelectionKeyboard(language?: AppLanguage) {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback(
          this.translate.t("telegram.language.options.english", { lang: language }),
          `language:${AppLanguage.ENGLISH}`
        ),
        Markup.button.callback(
          this.translate.t("telegram.language.options.russian", { lang: language }),
          `language:${AppLanguage.RUSSIAN}`
        ),
      ],
      [
        Markup.button.callback(this.translate.t("telegram.language.options.french", { lang: language }), `language:${AppLanguage.FRENCH}`),
        Markup.button.callback(
          this.translate.t("telegram.language.options.italian", { lang: language }),
          `language:${AppLanguage.ITALIAN}`
        ),
      ],
    ]);
  }
}
