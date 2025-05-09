export class UserCreditsUpdatedEvent {
  constructor(
    public readonly telegramId: number,
    public readonly credits: number,
  ) {}
}
