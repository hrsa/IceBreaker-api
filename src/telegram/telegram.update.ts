import { Action, Command, Ctx, Help, On, Start, Update } from "nestjs-telegraf";
import { Context } from "telegraf";
import { TelegramService } from "./telegram.service";
import { AppLanguage } from "../common/constants/app-language.enum";
import { StateFactory } from "./states/state.factory";
import { CardRetrievalState } from "./states/card-retrieval.state";
import { CategorySelectionState } from "./states/category-selection.state";
import { I18nService } from "nestjs-i18n";
import { ProfileSelectionState } from "./states/profile-selection.state";
import { CardStatus } from "../card-preferences/entitites/card-preference.entity";

@Update()
export class TelegramUpdate {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly stateFactory: StateFactory,
    private readonly cardRetrievalState: CardRetrievalState,
    private readonly categorySelectionState: CategorySelectionState,
    private readonly profileSelectionState: ProfileSelectionState,
    private readonly translate: I18nService
  ) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    await this.telegramService.deleteUserMessage(ctx);
    await this.telegramService.deleteOldMessages(ctx);
    await this.telegramService.deleteBotMessage(ctx);
    await this.telegramService.setCommands(ctx.session);
    this.telegramService.resetMessageTracking(ctx.session);

    if (ctx.session.step === "help") {
      ctx.session.step = undefined;
    }

    if (!ctx.session.userId) {
      ctx.session.step = "authentication";
    }

    const state = this.stateFactory.getState(ctx);
    await state.handle(ctx);
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    await this.telegramService.setCommands(ctx.session);
    ctx.session.step = "help";
    await this.stateFactory.getState(ctx).handle(ctx);
  }

  @Action(/language:(.+)/)
  async handleLanguageSelection(@Ctx() ctx: Context) {
    if (!ctx.match) return;
    const language = ctx.match[1];
    if (!Object.values(AppLanguage).includes(language as AppLanguage)) return;
    ctx.session.language = language as AppLanguage;
    await this.telegramService.setCommands(ctx.session);

    if (ctx.callbackQuery && "message" in ctx.callbackQuery && ctx.callbackQuery.message) {
      try {
        await ctx.telegram.deleteMessage(ctx.callbackQuery.message.chat.id, ctx.callbackQuery.message.message_id);
      } catch (error) {
        console.error("Error deleting language selection message:", error);
      }
    }
    if (ctx.session.step) {
      const state = this.stateFactory.getState(ctx);
      if (state === this.stateFactory.getStateByName("card-retrieval") && ctx.session.card && ctx.session.card.id) {
        await this.handleBackToTheGame(ctx);
      } else {
        await state.handle(ctx);
      }
    } else {
      await this.start(ctx);
    }
  }

  @Command("language")
  async showLanguageSelection(@Ctx() ctx: Context) {
    await this.telegramService.setCommands(ctx.session);
    await this.telegramService.deleteUserMessage(ctx);
    const keyboard = this.telegramService.createLanguageSelectionKeyboard(ctx.session.language);
    const msg = await ctx.reply(this.translate.t("telegram.language.select_prompt", { lang: ctx.session.language }), keyboard);
    if ("message_id" in msg) {
      ctx.session.languageSelectionMessageId = msg.message_id;
    }
  }

  @Command("generate")
  @Action("game:generate")
  async handleGenerateGame(@Ctx() ctx: Context) {
    await this.telegramService.deleteUserMessage(ctx);
    if (!ctx.session.credits || ctx.session.credits < 1) {
      await this.telegramService.askUserToDonate(ctx);
      return;
    }
    ctx.session.step = "game-generation";
    await this.stateFactory.getState(ctx).handle(ctx);
  }

  @Command("broadcast")
  async handleBroadcast(@Ctx() ctx: Context) {
    await this.telegramService.deleteUserMessage(ctx);
    const isAdmin = await this.telegramService.userIsAdmin(ctx);
    if (!isAdmin) {
      await this.telegramService.updateOrSendMessage(ctx, this.translate.t("telegram.broadcast.not_allowed", { lang: ctx.session.language }));
      return;
    }
    ctx.session.step = "broadcast";
    await this.stateFactory.getState(ctx).handle(ctx);
  }

  @Command("delete_profile")
  async handleDeleteProfile(@Ctx() ctx: Context) {
    await this.telegramService.deleteUserMessage(ctx);
    if (!ctx.session.step || !ctx.session.userId) {
      await this.start(ctx);
      return;
    }
    ctx.session.step = "profile-deletion";
    await this.stateFactory.getStateByName("profile-deletion").handle(ctx);
  }

  @Action(/profile:new/)
  async handleProfileCreation(@Ctx() ctx: Context) {
    if (!ctx.session.step || !ctx.session.userId) {
      await this.start(ctx);
      return;
    }

    const state = this.stateFactory.getStateByName("profile-creation");
    await state.handle(ctx);
  }

  @Action(/profile:delete:cancel/)
  async handleProfileDeletionCancel(@Ctx() ctx: Context) {
    ctx.session.selectedProfileId = undefined;
    ctx.session.step = "profile-selection";
    await this.start(ctx);
    return;
  }

  @Action(/profile:delete:(.+)/)
  async handleProfileDeletion(@Ctx() ctx: Context) {
    if (!ctx.session.userId) {
      await this.start(ctx);
      return;
    }
    if (ctx.match && ctx.match.length > 1) {
      const profileId = ctx.match[1];
      await this.telegramService.deleteProfile(ctx.session.userId, profileId);
      ctx.session.step = "profile-selection";
      ctx.session.selectedProfileId = undefined;

      return this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.profile.deletion.success", {
          lang: ctx.session.language,
        })
      );
    }
  }

  @Action(/profile:(.+)/)
  async handleProfileSelection(@Ctx() ctx: Context) {
    if (!ctx.session.userId) {
      await this.start(ctx);
      return;
    }
    await this.telegramService.setCommands(ctx.session);
    const state = this.stateFactory.getState(ctx);
    await state.next(ctx);
  }

  @Action(/category:(.+)/)
  async handleCategorySelection(@Ctx() ctx: Context) {
    if (!ctx.session.selectedProfileId) {
      ctx.session.step = "profile-selection";
      const profileState = this.stateFactory.getState(ctx);
      await profileState.next(ctx);
      return;
    }
    await this.telegramService.setCommands(ctx.session);
    await this.categorySelectionState.next(ctx);
  }

  @Action("categories:done")
  async handleCategoriesComplete(@Ctx() ctx: Context) {
    await this.categorySelectionState.complete(ctx);
    await this.cardRetrievalState.handle(ctx);
  }

  @Action("signup:email")
  async handleSignupEmail(@Ctx() ctx: Context) {
    ctx.session.step = "signup-email";
    const state = this.stateFactory.getState(ctx);
    await state.handle(ctx);
  }

  @Action("card:another")
  async handleGetAnotherCard(@Ctx() ctx: Context) {
    if (!ctx.session.selectedProfileId) {
      await this.profileSelectionState.handle(ctx);
      return;
    }
    await this.cardRetrievalState.getRandomCard(ctx);
  }

  @Action("card:undo")
  async handleGetPreviousCard(@Ctx() ctx: Context) {
    if (ctx.session.previousCard) {
      ctx.session.card = ctx.session.previousCard;
      ctx.session.previousCard = undefined;
    }
    await this.cardRetrievalState.getRandomCard(ctx, true);
  }

  @Action("card:change_categories")
  async handleChangeCategories(@Ctx() ctx: Context) {
    ctx.session.step = "category-selection";
    ctx.session.selectedCategoryIds = [];

    await this.stateFactory.getStateByName("category-selection").handle(ctx);
  }

  @Action("card:change_profile")
  async handleChangeProfile(@Ctx() ctx: Context) {
    ctx.session.step = "profile-selection";
    ctx.session.selectedProfileId = undefined;
    ctx.session.selectedCategoryIds = [];

    await this.stateFactory.getStateByName("profile-selection").handle(ctx);
  }

  @Action("card:change_language")
  async handleChangeCardLanguage(@Ctx() ctx: Context) {
    await this.showLanguageSelection(ctx);
  }

  @Action("card:start_over")
  async handleStartOver(@Ctx() ctx: Context) {
    await this.start(ctx);
  }

  @Action("card:love")
  async handleLove(@Ctx() ctx: Context) {
    if (!ctx.session.selectedProfileId) {
      await this.profileSelectionState.handle(ctx);
      return;
    }
    await this.telegramService.updateCardPreference(ctx, CardStatus.LOVED);
    await this.cardRetrievalState.getRandomCard(ctx);
  }

  @Action("card:ban")
  async handleBan(@Ctx() ctx: Context) {
    if (!ctx.session.selectedProfileId) {
      await this.profileSelectionState.handle(ctx);
      return;
    }
    await this.telegramService.updateCardPreference(ctx, CardStatus.BANNED);
    await this.cardRetrievalState.getRandomCard(ctx);
  }

  @Action("card:archive")
  async handleArchive(@Ctx() ctx: Context) {
    if (!ctx.session.selectedProfileId) {
      await this.profileSelectionState.handle(ctx);
      return;
    }
    await this.telegramService.updateCardPreference(ctx, CardStatus.ARCHIVED);
    await this.cardRetrievalState.getRandomCard(ctx);
  }

  @Action("card:reactivate")
  async handleActivate(@Ctx() ctx: Context) {
    if (!ctx.session.selectedProfileId) {
      await this.profileSelectionState.handle(ctx);
      return;
    }
    await this.telegramService.updateCardPreference(ctx, CardStatus.ACTIVE);
    await this.cardRetrievalState.getRandomCard(ctx);
  }

  @Action("card:toggle_archived")
  async toggleArchived(@Ctx() ctx: Context) {
    if (!ctx.session.selectedProfileId) {
      await this.profileSelectionState.handle(ctx);
      return;
    }
    ctx.session.includeArchived = !ctx.session.includeArchived;
    await this.cardRetrievalState.getRandomCard(ctx, true);
  }

  @Action("card:toggle_loved")
  async toggleLoved(@Ctx() ctx: Context) {
    if (!ctx.session.selectedProfileId) {
      await this.profileSelectionState.handle(ctx);
      return;
    }
    ctx.session.includeLoved = !ctx.session.includeLoved;
    await this.cardRetrievalState.getRandomCard(ctx, true);
  }

  @Action("card:back_to_the_game")
  async handleBackToTheGame(@Ctx() ctx: Context) {
    await this.telegramService.setCommands(ctx.session);
    if (!ctx.session.selectedProfileId) {
      ctx.session.step = "profile-selection";
      await this.stateFactory.getStateByName("profile-selection").handle(ctx);
      return;
    }
    if (!ctx.session.selectedCategoryIds) {
      ctx.session.step = "category-selection";
      await this.stateFactory.getStateByName("category-selection").handle(ctx);
      return;
    }
    ctx.session.step = "card-retrieval";
    await this.stateFactory.getStateByName("card-retrieval").handle(ctx, true);
  }

  @Command("suggest")
  async handleSuggestionCreation(@Ctx() ctx: Context) {
    ctx.session.step = "suggestion-creation";
    const state = this.stateFactory.getStateByName("suggestion-creation");
    await state.handle(ctx);
  }

  @Command("hello")
  async sayHello(@Ctx() ctx: Context) {
    await this.telegramService.sayHello(ctx);
  }

  @On("text")
  async handleMessage(@Ctx() ctx: Context) {
    if (!ctx.session.step) {
      ctx.session.step = "authentication";
    }

    const state = this.stateFactory.getState(ctx);
    await state.next(ctx);
    if (ctx.chat?.id && ctx.message && ctx.message.message_id) {
      await this.telegramService.safeDeleteMessage(ctx.chat.id, ctx.message.message_id);
    }
  }
}
