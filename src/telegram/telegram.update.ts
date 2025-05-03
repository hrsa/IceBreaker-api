import { Action, Command, Ctx, Help, On, Start, Update } from "nestjs-telegraf";
import { Context } from "telegraf";
import { TelegramService } from "./telegram.service";
import { AppLanguage } from "../common/constants/app-language.enum";
import { StateFactory } from "./states/state.factory";
import { CardRetrievalState } from "./states/card-retrieval.state";
import { CategorySelectionState } from "./states/category-selection.state";
import { I18nService } from "nestjs-i18n";

@Update()
export class TelegramUpdate {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly stateFactory: StateFactory,
    private readonly cardRetrievalState: CardRetrievalState,
    private readonly categorySelectionState: CategorySelectionState,
    private readonly translate: I18nService
  ) {}

  @Start()
  async start(@Ctx() ctx: Context) {
    ctx.session.botMessageId = undefined;
    ctx.session.lastMessageText = undefined;

    if (!ctx.session.language) {
      ctx.session = { language: AppLanguage.ENGLISH };
    }
    const state = this.stateFactory.getState(ctx);
    await state.handle(ctx);
  }

  @Help()
  async help(@Ctx() ctx: Context) {
    await this.telegramService.updateOrSendMessage(
      ctx,
      this.translate.t("telegram.help.message", { lang: ctx.session.language })
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
        await state.handle(ctx, true);
      } else {
        await state.handle(ctx)
      }
    } else {
      await this.start(ctx);
    }
  }

  @Command("language")
  async showLanguageSelection(@Ctx() ctx: Context) {
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

  // Handle category selection
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

  @Action("card:another")
  async handleGetAnotherCard(@Ctx() ctx: Context) {
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

  @On("text")
  async handleMessage(@Ctx() ctx: Context) {
    if (!ctx.session.step) {
      ctx.session.step = "authentication";
    }

    const state = this.stateFactory.getState(ctx);
    await state.next(ctx);
  }
}
