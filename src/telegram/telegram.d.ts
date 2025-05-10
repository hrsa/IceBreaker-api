import { TelegramSession } from "./interfaces/telegram-session.interface";

declare module "telegraf" {
  interface Context {
    session: TelegramSession;
    match: RegExpExecArray | null;
  }
}
