import { Card } from "../entities/card.entity";

export class CardCreatedEvent {
  constructor(public readonly card: Card) {}
}
