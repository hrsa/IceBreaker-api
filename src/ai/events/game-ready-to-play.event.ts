import { User } from "../../users/entities/user.entity";
import { Category } from "../../categories/entities/category.entity";

export class GameReadyToPlayEvent {
  constructor(
    public readonly user: User,
    public readonly category: Category
  ) {}
}
