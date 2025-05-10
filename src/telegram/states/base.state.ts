import { Context } from "telegraf";

export interface BotState {
  handle(ctx: Context, parameter?: boolean): Promise<void>;
  next(ctx: Context): Promise<void>;
}
