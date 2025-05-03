import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { AuthenticationState } from "./authentication.state";
import { ProfileSelectionState } from "./profile-selection.state";
import { CategorySelectionState } from "./category-selection.state";
import { CardRetrievalState } from "./card-retrieval.state";
import { BotState } from "./base.state";
import { ProfileCreationState } from "./profile-creation.state";

@Injectable()
export class StateFactory {
  constructor(
    private readonly authenticationState: AuthenticationState,
    private readonly profileSelectionState: ProfileSelectionState,
    private readonly profileCreationState: ProfileCreationState,
    private readonly categorySelectionState: CategorySelectionState,
    private readonly cardRetrievalState: CardRetrievalState
  ) {}

  getState(ctx: Context): BotState {
    if (!ctx.session.userId) {
      return this.authenticationState;
    }

    if (ctx.session.step === "profile-creation") {
      return this.profileCreationState;
    }

    if (!ctx.session.selectedProfileId) {
      return this.profileSelectionState;
    }

    if (!ctx.session.selectedCategoryIds) {
      return this.categorySelectionState;
    }

    return this.cardRetrievalState;
  }

  getStateByName(stateName: string): BotState {
    switch (stateName) {
      case "authentication":
        return this.authenticationState;
      case "profile-selection":
        return this.profileSelectionState;
      case "profile-creation":
        return this.profileCreationState;
      case "category-selection":
        return this.categorySelectionState;
      case "card-retrieval":
        return this.cardRetrievalState;
      default:
        return this.authenticationState;
    }
  }
}
