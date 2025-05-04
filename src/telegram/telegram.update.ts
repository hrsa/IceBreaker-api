import { Action, Command, Ctx, Help, On, Start, Update } from "nestjs-telegraf";
import { Context, Markup } from 'telegraf';
import { TelegramService } from "./telegram.service";
import { AppLanguage } from "../common/constants/app-language.enum";
import { StateFactory } from "./states/state.factory";
import { CardRetrievalState } from "./states/card-retrieval.state";
import { CategorySelectionState } from "./states/category-selection.state";
import { I18nService } from "nestjs-i18n";
import { ProfileSelectionState } from './states/profile-selection.state';
import { CardStatus } from '../card-preferences/entitites/card-preference.entity';

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
    this.telegramService.resetMessageTracking(ctx);

    if (!ctx.session.userId) {
      ctx.session.step = "authentication";
    }

    const state = this.stateFactory.getState(ctx);
    await state.handle(ctx);
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    await this.telegramService.deleteUserMessage(ctx);
    await this.telegramService.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.help.message", { lang: ctx.session.language }),
      Markup.inlineKeyboard([Markup.button.callback(
        this.translate.t("telegram.card.actions.change_language", { lang: ctx.session.language }),
        "card:change_language"
      )])
    );
  }

  @Action(/language:(.+)/)
  async handleLanguageSelection(@Ctx() ctx: Context) {
    if (!ctx.match) return;
    const language = ctx.match[1];
    if (!Object.values(AppLanguage).includes(language as AppLanguage)) return;
    ctx.session.language = language as AppLanguage;

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
        await this.handleBackToTheGame(ctx)
      } else {
        await state.handle(ctx)
      }
    } else {
      await this.start(ctx);
    }
  }

  @Command("language")
  async showLanguageSelection(@Ctx() ctx: Context) {
    await this.telegramService.deleteUserMessage(ctx);
    const keyboard = this.telegramService.createLanguageSelectionKeyboard(ctx.session.language);
    const msg = await ctx.reply(this.translate.t("telegram.language.select_prompt", { lang: ctx.session.language }), keyboard);
    if ("message_id" in msg) {
      ctx.session.languageSelectionMessageId = msg.message_id;
    }
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

  @Action(/profile:(.+)/)
  async handleProfileSelection(@Ctx() ctx: Context) {
    if (!ctx.session.userId) {
      await this.start(ctx);
      return;
    }

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
    console.log(ctx);
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

  @Action("card:change_categories")
  async handleChangeCategories(@Ctx() ctx: Context) {
    ctx.session.step = "category-selection";
    ctx.session.selectedCategoryIds = [];

    await this.categorySelectionState.handle(ctx);
  }

  @Action("card:change_profile")
  async handleChangeProfile(@Ctx() ctx: Context) {
    ctx.session.step = "profile-selection";
    ctx.session.selectedProfileId = undefined;
    ctx.session.selectedCategoryIds = [];

    const profileState = this.stateFactory.getStateByName("profile-selection");
    await profileState.handle(ctx);
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
    if (!ctx.session.selectedProfileId) {
      ctx.session.step = "profile-selection";
      await this.profileSelectionState.handle(ctx);
      return;
    }
    if (!ctx.session.selectedCategoryIds) {
      ctx.session.step = "category-selection";
      await this.categorySelectionState.handle(ctx);
      return;
    }
    ctx.session.step = "card-retrieval";
    await this.cardRetrievalState.handle(ctx, true);
  }

  @Command("suggest")
  async handleSuggestionCreation(@Ctx() ctx: Context) {
    ctx.session.step = "suggestion-creation";
    const state = this.stateFactory.getStateByName("suggestion-creation");
    await state.handle(ctx);
  }

  @On("text")
  async handleMessage(@Ctx() ctx: Context) {
    if (!ctx.session.step) {
      ctx.session.step = "authentication";
    }

    const state = this.stateFactory.getState(ctx);
    await state.next(ctx);
  }
}
