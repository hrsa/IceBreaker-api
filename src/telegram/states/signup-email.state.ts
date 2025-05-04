import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TelegramService } from "../telegram.service";
import { BotState } from "./base.state";
import { I18nService } from "nestjs-i18n";
import { StateFactory } from "./state.factory";
import { isEmail } from "class-validator";

@Injectable()
export class SignupEmailState implements BotState {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly translate: I18nService,
    @Inject(forwardRef(() => StateFactory))
    private readonly stateFactory: StateFactory
  ) {}

  async handle(ctx: Context): Promise<void> {
    ctx.session.step = "signup-email";
    await this.telegramService.updateOrSendMessage(ctx, this.translate.t("telegram.signup.enter_email", { lang: ctx.session.language }));
  }

  async next(ctx: Context): Promise<void> {
    if (!ctx.message || !("text" in ctx.message)) {
      return;
    }

    const email = ctx.message.text.trim();
    if (ctx.chat) {
      await this.telegramService.safeDeleteMessage(ctx.chat.id, ctx.message.message_id);
    }

    if (email.length < 1 || !isEmail(email)) {
      await this.telegramService.updateOrSendMessage(
        ctx,
        this.translate.t("telegram.signup.enter_email", { args: { email: email }, lang: ctx.session.language })
      );
      return;
    }

    try {
      const user = await this.telegramService.getUserByEmail(email);
      if (user) {
        await this.telegramService.updateOrSendMessage(
          ctx,
          this.translate.t("telegram.signup.user_exists", { lang: ctx.session.language })
        );
        return;
      }
    } catch (e) {}
    ctx.session.email = email;
    ctx.session.step = "signup-name";
    await this.stateFactory.getState(ctx).handle(ctx);
  }
}
