export class GameGenerationCompletedEvent {
  constructor(public readonly userId: string, public readonly categoryId: string) {
  }
}