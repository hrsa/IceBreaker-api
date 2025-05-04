import { forwardRef, Inject, Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { AuthenticationState } from "./authentication.state";
import { ProfileSelectionState } from "./profile-selection.state";
import { CategorySelectionState } from "./category-selection.state";
import { CardRetrievalState } from "./card-retrieval.state";
import { BotState } from "./base.state";
import { ProfileCreationState } from "./profile-creation.state";
import { SuggestionCreationState } from "./suggestion-creation.state";
import { SignupEmailState } from "./signup-email.state";
import { SignupNameState } from "./signup-name.state";

@Injectable()
export class StateFactory {
  constructor(
    private readonly authenticationState: AuthenticationState,
    private readonly profileSelectionState: ProfileSelectionState,
    private readonly profileCreationState: ProfileCreationState,
    private readonly categorySelectionState: CategorySelectionState,
    private readonly cardRetrievalState: CardRetrievalState,
    private readonly suggestionCreationState: SuggestionCreationState,
    @Inject(forwardRef(() => SignupEmailState))
    private readonly signupEmailState: SignupEmailState,
    private readonly signupNameState: SignupNameState
  ) {}

  getState(ctx: Context): BotState {
    if (ctx.session.step === "signup-email") {
      return this.signupEmailState;
    }

    if (ctx.session.step === "signup-name") {
      if (!ctx.session.email) {
        return this.signupEmailState;
      }
      return this.signupNameState;
    }

    if (!ctx.session.userId) {
      return this.authenticationState;
    }

    if (ctx.session.step === "profile-creation") {
      return this.profileCreationState;
    }

    if (ctx.session.step === "suggestion-creation") {
      return this.suggestionCreationState;
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
      case "suggestion-creation":
        return this.suggestionCreationState;
      case "signup-email":
        return this.signupEmailState;
      default:
        return this.authenticationState;
    }
  }
}
