export type EmailType = "change-password" | "welcome" | "connect-telegram";

export interface PasswordResetData {
  resetLink: string;
}

export interface WelcomeData {
  confirmLink: string;
}

export interface ConnectTelegramData {
  tgLink: string;
}

export interface EmailDataMap {
  "change-password": PasswordResetData;
  "welcome": WelcomeData;
  "connect-telegram": ConnectTelegramData;
}

export class SendEmailEvent<T extends EmailType> {
  constructor(
    public readonly type: T,
    public readonly email: string,
    public readonly data: EmailDataMap[T]
  ) {}
}