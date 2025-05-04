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
import { CreateUserDto } from "src/users/dto/create-user.dto";
import { generate } from "random-words";
import { validateOrReject } from "class-validator";
import { CardPreferencesService } from "../card-preferences/card-preferences.service";
import { CardStatus } from "../card-preferences/entitites/card-preference.entity";

@Injectable()
export class TelegramService {
  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    private usersService: UsersService,
    private profilesService: ProfilesService,
    private categoriesService: CategoriesService,
    private cardsService: CardsService,
    private cardPreferencesService: CardPreferencesService,
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

  resetMessageTracking(ctx: Context): void {
    ctx.session.botMessageIds = [];
    ctx.session.botMessageId = undefined;
    ctx.session.lastMessageText = undefined;
  }

  async safeDeleteMessage(chatId: number | string, messageId: number): Promise<boolean> {
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
    if (!ctx.chat || !ctx.session.botMessageIds || ctx.session.botMessageIds.length <= 1) {
      return;
    }

    const messagesToDelete = ctx.session.botMessageIds.slice(0, -1);

    for (const messageId of messagesToDelete) {
      await this.safeDeleteMessage(ctx.chat.id, messageId);
    }
    ctx.session.botMessageIds = ctx.session.botMessageIds.slice(-1);
  }

  async registerNewUser(ctx: Context, name: string): Promise<void> {
    const telegramId = this.getTelegramId(ctx);
    if (!ctx.session.email) {
      throw new Error(this.translate.t("telegram.signup.email_empty", { lang: ctx.session.language }));
    }
    if (!telegramId) {
      throw new Error(this.translate.t("telegram.errors.no_telegram_id", { lang: ctx.session.language }));
    }

    try {
      const createUserDto = new CreateUserDto();
      createUserDto.name = name;
      createUserDto.email = ctx.session.email;
      createUserDto.telegramId = telegramId;
      createUserDto.password = generate({ exactly: 1, minLength: 10 })[0];
      await validateOrReject(createUserDto);
      const user = await this.usersService.create(createUserDto);
      if (user) {
        ctx.session.userId = user.id;
        return this.welcomeUser(ctx, user.name);
      }
    } catch (error) {
      throw new Error("Error creating user: " + error.message);
    }
  }

  async getUserByEmail(email: string) {
    return this.usersService.findByEmail(email);
  }

  async authenticateBySecretPhrase(ctx: Context, secretPhrase: string) {
    const telegramId = this.getTelegramId(ctx);
    if (!telegramId) {
      throw new Error(this.translate.t("telegram.errors.no_telegram_id", { lang: ctx.session.language }));
    }

    try {
      const user = await this.usersService.connectTelegram(telegramId, secretPhrase);
      if (user) {
        ctx.session.userId = user.id;
        ctx.session.email = user.email;
        return this.welcomeUser(ctx, user.name);
      }
    } catch (e) {
      throw new Error(this.translate.t("telegram.authentication.invalid_secret_phrase", { lang: ctx.session.language }));
    }
  }

  getTelegramId(ctx: Context) {
    const telegramUser = ctx.callbackQuery?.from || ctx.message?.from;
    return telegramUser?.id;
  }

  async getProfilesForUser(userId: string) {
    return this.profilesService.findAll(userId);
  }

  async welcomeUser(ctx: Context, name: string) {
    await this.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.authentication.success", { args: { name: name }, lang: ctx.session.language }),
      this.createBackToTheGameKeyboard(ctx.session.language)
    );
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

  async updateCardPreference(ctx: Context, action: CardStatus) {
    const cardId = ctx.session.card?.id;
    const profileId = ctx.session.selectedProfileId;
    if (!cardId || !ctx.session.card) {
      await this.replyAndSave(ctx, this.translate.t("telegram.errors.no_card", { lang: ctx.session.language }));
      return;
    }
    if (!profileId) {
      await this.replyAndSave(ctx, this.translate.t("telegram.errors.no_profile", { lang: ctx.session.language }));
      return;
    }
    let cardPreference;
    switch (action) {
      case CardStatus.LOVED:
        cardPreference = await this.cardPreferencesService.loveCard(cardId, profileId);
        break;
      case CardStatus.BANNED:
        cardPreference = await this.cardPreferencesService.banCard(cardId, profileId);
        break;
      case CardStatus.ARCHIVED:
        cardPreference = await this.cardPreferencesService.archiveCard(cardId, profileId);
        break;
      case CardStatus.ACTIVE:
        cardPreference = await this.cardPreferencesService.reactivateCard(cardId, profileId);
        break;
    }
    ctx.session.card.cardPreference = cardPreference;
  }

  createBackToTheGameKeyboard(language?: AppLanguage) {
    return Markup.inlineKeyboard([
      Markup.button.callback(this.translate.t("telegram.buttons.back_to_the_game", { lang: language }), "card:back_to_the_game"),
    ]);
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

  createCardActionsKeyboard(ctx: Context) {
    const language = ctx.session.language;
    const cardStatus = ctx.session.card?.cardPreference?.status;

    const includeArchivedText = ctx.session.includeArchived
      ? this.translate.t("telegram.card.actions.exclude_archived", { lang: language })
      : this.translate.t("telegram.card.actions.include_archived", { lang: language });
    const includeArchived = Markup.button.callback(includeArchivedText, "card:toggle_archived");

    const includeLovedText = ctx.session.includeLoved
      ? this.translate.t("telegram.card.actions.exclude_loved", { lang: language })
      : this.translate.t("telegram.card.actions.include_loved", { lang: language });
    const includeLoved = Markup.button.callback(includeLovedText, "card:toggle_loved");

    const changeCategories = Markup.button.callback(
      this.translate.t("telegram.card.actions.change_categories", { lang: language }),
      "card:change_categories"
    );
    const changeProfile = Markup.button.callback(
      this.translate.t("telegram.card.actions.change_profile", { lang: language }),
      "card:change_profile"
    );
    const changeLanguage = Markup.button.callback(
      this.translate.t("telegram.card.actions.change_language", { lang: language }),
      "card:change_language"
    );
    return Markup.inlineKeyboard([
      this.buildCardActions(cardStatus),
      [includeArchived, includeLoved],
      [changeCategories, changeProfile],
      [changeLanguage]]);
  }

  buildCardActions(cardStatus?: string) {
    const anotherCard = Markup.button.callback("🃏", "card:another");
    const loveCard = Markup.button.callback("❤️", "card:love");
    const unLoveCard = Markup.button.callback("💔", "card:reactivate");
    const archiveCard = Markup.button.callback("🗄️", "card:archive");
    const unArchiveCard = Markup.button.callback("🗃️", "card:reactivate");
    const banCard = Markup.button.callback("🚫", "card:ban");

    switch (cardStatus) {
      case CardStatus.LOVED:
        return [anotherCard, unLoveCard, archiveCard, banCard];
      case CardStatus.ARCHIVED:
        return [anotherCard, unArchiveCard, loveCard, banCard];
      default:
        return [anotherCard, loveCard, archiveCard, banCard];
    }
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
