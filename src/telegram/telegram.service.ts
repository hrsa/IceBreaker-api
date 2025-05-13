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
import { CreateUserDto } from "../users/dto/create-user.dto";
import { generate } from "random-words";
import { validateOrReject } from "class-validator";
import { CardPreferencesService } from "../card-preferences/card-preferences.service";
import { CardPreference, CardStatus } from "../card-preferences/entitites/card-preference.entity";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { TelegramSession } from "./interfaces/telegram-session.interface";
import { RedisSessionService } from "../redis/redis-session.middleware";
import { UserCreditsUpdatedEvent } from "../users/events/user-credits-updated.event";
import { TelegramMessageEvent } from "./events/telegram-message.event";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { GameReadyToPlayEvent } from "../ai/events/game-ready-to-play.event";
import { AIService } from "../ai/ai.service";
import * as fs from "node:fs";

@Injectable()
export class TelegramService {
  constructor(
    @InjectBot() private bot: Telegraf<Context>,
    @InjectQueue("telegram-messages") private telegramQueue: Queue,
    private readonly configService: ConfigService,
    private redisSessionService: RedisSessionService,
    private usersService: UsersService,
    private profilesService: ProfilesService,
    private categoriesService: CategoriesService,
    private cardsService: CardsService,
    private cardPreferencesService: CardPreferencesService,
    private suggestionsService: SuggestionsService,
    private languageUtilsService: LanguageUtilsService,
    private aiService: AIService,
    private translate: I18nService
  ) {}

  private readonly logger = new Logger(TelegramService.name);

  async onModuleInit() {
    await this.setCommands();
  }

  async setCommands(session?: TelegramSession) {
    const basicCommands = [
      {
        command: "start",
        description: this.translate.t("telegram.commands.start.description", { lang: session?.language }),
      },
      {
        command: "help",
        description: this.translate.t("telegram.commands.help.description", { lang: session?.language }),
      },
      {
        command: "language",
        description: this.translate.t("telegram.commands.language.description", { lang: session?.language }),
      },
      {
        command: "suggest",
        description: this.translate.t("telegram.commands.suggest.description", { lang: session?.language }),
      },
      {
        command: "delete_profile",
        description: this.translate.t("telegram.commands.delete_profile.description", { lang: session?.language }),
      },
    ];
    const generateCommand = {
      command: "generate",
      description: this.translate.t("telegram.commands.generate.description", { lang: session?.language }),
    };

    if (session?.credits && session?.credits > 0) {
      basicCommands.splice(1, 0, generateCommand);
    }

    return await this.bot.telegram.setMyCommands(basicCommands);
  }

  private initMessageIds(session: TelegramSession): void {
    if (!session.botMessageIds) {
      session.botMessageIds = [];
    }
  }

  private trackMessage(session: TelegramSession, messageId: number, text: string): void {
    this.initMessageIds(session);
    session.botMessageIds!.push(messageId);
    session.botMessageId = messageId;
    session.lastMessageText = text;
  }

  resetMessageTracking(session: TelegramSession): void {
    session.botMessageIds = [];
    session.botMessageId = undefined;
    session.lastMessageText = undefined;
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
      this.trackMessage(ctx.session, sentMsg.message_id, text);
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
    this.initMessageIds(ctx.session);
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
      this.trackMessage(ctx.session, sentMsg.message_id, text);

      if (ctx.session.botMessageIds && ctx.session.botMessageIds.length > 1) {
        await this.deleteOldMessages(ctx);
      }
    }

    return sentMsg;
  }

  private async recoverAndSendMessage(ctx: Context, text: string, extra?: any): Promise<any> {
    this.resetMessageTracking(ctx.session);

    try {
      const sentMsg = await ctx.reply(text, extra);

      if ("message_id" in sentMsg) {
        this.trackMessage(ctx.session, sentMsg.message_id, text);
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

  async sayHello(ctx: Context) {
    if (!ctx.chat) {
      return;
    }
    await this.deleteUserMessage(ctx);
    const user = await this.usersService.findByTelegramId(ctx.chat.id.toString());
    if (user) {
      const helloFilepath = await this.aiService.sayHello(user.name, ctx.session.language);
      const helloFile = fs.createReadStream(helloFilepath);
      const voiceMessage = await this.bot.telegram.sendVoice(ctx.chat!.id, { source: helloFile });
      this.trackMessage(ctx.session, voiceMessage.message_id, "");
      fs.unlinkSync(helloFilepath);
    }
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
      createUserDto.telegramId = telegramId.toString();
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

  async welcomeUser(ctx: Context, name: string) {
    await this.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.authentication.success", { args: { name: name }, lang: ctx.session.language }),
      this.createBackToTheGameKeyboard(ctx.session.language)
    );
  }

  getBuyCoffeeButton(session: TelegramSession) {
    let trackData: string;
    if (session.email) {
      trackData = Buffer.from(session.email).toString("base64");
    } else {
      trackData = Buffer.from("unknown user").toString("base64");
    }

    return Markup.button.url(
      this.translate.t("telegram.buttons.buy_me_a_coffee", { lang: session.language }),
      this.configService.getOrThrow<string>("APP_URL") + `/api/coffee?coffee=${trackData}`
    );
  }

  async getCategoriesForSelection(userId?: string) {
    return this.categoriesService.findAll(userId);
  }

  async createProfile(userId: string, name: string) {
    return this.profilesService.create({ userId, name });
  }

  async deleteProfile(userId: string, profileId: string) {
    return this.profilesService.remove(profileId, userId);
  }

  async getProfilesForUser(userId: string) {
    return this.profilesService.findAll(userId);
  }

  async getProfileName(profileId: string) {
    const profile = await this.profilesService.findOne(profileId);
    return profile?.name;
  }

  async generateNewGame(ctx: Context, description: string) {
    if (ctx.session.userId && ctx.session.credits && ctx.session.credits > 0) {
      await this.aiService.createCustomGame(description, ctx.session.userId);
      await this.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.generate.generation_started", { lang: ctx.session.language }),
        this.createBackToTheGameKeyboard(ctx.session.language)
      );
    } else {
      await this.askUserToDonate(ctx);
    }

    return;
  }

  async askUserToDonate(ctx: Context) {
    return this.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.generate.no_credits", { lang: ctx.session.language }),
      Markup.inlineKeyboard([
        [
          Markup.button.callback(
            this.translate.t("telegram.buttons.back_to_the_game", { lang: ctx.session.language }),
            "card:back_to_the_game"
          ),
        ],
        [this.getBuyCoffeeButton(ctx.session)],
      ])
    );
  }

  @OnEvent("game.ready.to.play")
  async handleGameReadyToPlay(event: GameReadyToPlayEvent) {
    const { user, category } = event;
    if (!user.telegramId) {
      return;
    }
    const session = await this.redisSessionService.getSession(user.telegramId);
    const language = session.language;
    const categoryName = this.languageUtilsService.getPropertyByLanguage(category, "name", language);
    await this.telegramQueue.add(
      "send-message",
      {
        telegramId: user.telegramId,
        text: this.translate.t("telegram.generate.ready_to_play", {
          args: { categoryName },
          lang: language,
        }),
        extra: Markup.inlineKeyboard([
          Markup.button.callback(this.translate.t("telegram.buttons.start_the_game", { lang: language }), "card:change_profile"),
        ]),
      },
      { delay: 1000 }
    );
  }

  @OnEvent("user.credits.updated")
  @OnEvent("telegram.message")
  async sendNotificationToUserMessage(event: UserCreditsUpdatedEvent | TelegramMessageEvent) {
    if (!event.telegramId) {
      return;
    }
    const session = await this.redisSessionService.getSession(event.telegramId);
    if (event instanceof UserCreditsUpdatedEvent) {
      await this.telegramQueue.add(
        "send-message",
        {
          telegramId: event.telegramId,
          text: this.translate.t("telegram.credits.updated", {
            args: { credits: event.credits },
            lang: session.language,
          }),
          extra: this.createBackToTheGameKeyboard(session.language),
        },
        { delay: 1000 }
      );
    } else {
      await this.telegramQueue.add(
        "send-message",
        {
          telegramId: event.telegramId,
          text: event.messageText,
          extra: event.extra,
        },
        { delay: 1000 }
      );
    }
  }

  async getRandomCard(dto: GetRandomCardDto, userId?: string) {
    const result = await this.cardsService.getRandomCard(dto, userId);
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
    let cardPreference: CardPreference | null;
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
      default:
        cardPreference = await this.cardPreferencesService.reactivateCard(cardId, profileId);
        break;
    }
    if (cardPreference) {
      ctx.session.card.cardPreference = cardPreference;
    }
  }

  createBackToTheGameKeyboard(language?: AppLanguage) {
    return Markup.inlineKeyboard([
      Markup.button.callback(this.translate.t("telegram.buttons.back_to_the_game", { lang: language }), "card:back_to_the_game"),
    ]);
  }

  createProfileKeyboard(profiles: Profile[], language?: AppLanguage, deleteProfile = false) {
    const buttons = profiles.map(profile => [Markup.button.callback(profile.name, `profile:${profile.id}`)]);
    if (!deleteProfile) {
      buttons.push([Markup.button.callback(this.translate.t("telegram.profile.selection.create_new", { lang: language }), "profile:new")]);
    }
    return Markup.inlineKeyboard(buttons);
  }

  createCategoryKeyboard(categories: Category[], language: AppLanguage, selectedCategoryIds: string[] = []) {
    const buttons = categories.map(category => {
      const isSelected = selectedCategoryIds.includes(category.id);
      let categoryName = this.languageUtilsService.getPropertyByLanguage(category, "name", language);
      if (!categoryName) categoryName = "MISSING TRANSLATION";
      let categoryButtonText = isSelected ? `${categoryName} ✅` : categoryName;
      if (!category.isPublic) {
        categoryButtonText = `🔒 ${categoryButtonText}`;
      }
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
    const hasPreviousCard = ctx.session.previousCard !== undefined;

    const { cardActions, reactionButton } = this.buildCardActions(hasPreviousCard, cardStatus);

    const includeLovedText = ctx.session.includeLoved
      ? this.translate.t("telegram.card.actions.exclude_loved", { lang: language })
      : this.translate.t("telegram.card.actions.include_loved", { lang: language });
    const includeLoved = Markup.button.callback(includeLovedText, "card:toggle_loved");

    const homeButton = Markup.button.callback(this.translate.t("🏠", { lang: language }), "card:change_profile");
    const changeLanguage = Markup.button.callback(
      this.translate.t("telegram.card.actions.change_language", { lang: language }),
      "card:change_language"
    );
    return Markup.inlineKeyboard([cardActions, [reactionButton], [homeButton, includeLoved], [changeLanguage]]);
  }

  buildCardActions(hasPreviousCard: boolean, cardStatus?: string) {
    const nextCardAction = cardStatus === CardStatus.LOVED ? "card:love" : "card:archive";
    const nextCard = Markup.button.callback("⏩", nextCardAction);
    const loveCard = Markup.button.callback("❤️", "card:love");
    const unLoveCard = Markup.button.callback("💔", "card:reactivate");
    const getPreviousCard = Markup.button.callback("⏪", "card:undo");
    const cardActions: any[] = [];

    if (hasPreviousCard) {
      cardActions.push(getPreviousCard);
    }

    cardActions.push(nextCard);

    if (cardStatus === CardStatus.LOVED) {
      return { cardActions, reactionButton: unLoveCard };
    }

    return { cardActions, reactionButton: loveCard };
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
