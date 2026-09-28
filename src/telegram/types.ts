import { Context, Markup } from "telegraf";
import { Convenience } from "telegraf/types";

/** Extra options object accepted by Telegraf reply methods. */
export type TelegrafExtra = Convenience.ExtraReplyMessage;

/** Extra options object accepted by Telegram editMessageText calls. */
export type EditExtra = Convenience.ExtraEditMessageText;

/** Result of a Telegraf reply call. */
export type ReplyResult = Awaited<ReturnType<Context["reply"]>>;

/** An inline keyboard callback button. */
export type CallbackButton = ReturnType<typeof Markup.button.callback>;
