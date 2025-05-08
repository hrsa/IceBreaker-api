export class TelegramMessageEvent {
  constructor(
    public readonly telegramId: string,
    public readonly messageText: string,
    public readonly extra?: any
  ) {}
}
