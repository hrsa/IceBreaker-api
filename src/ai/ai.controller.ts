import { Controller, Get, UseGuards, Query, Body, Post } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";
import { TranslationService } from "./translation.service";
import { AppLanguage } from "../common/constants/app-language.enum";
import { AIService } from "./ai.service";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentUserData } from "../auth/strategies/jwt.strategy";

@ApiTags("ai")
@Controller("ai")
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class AIController {
  constructor(
    private readonly translationService: TranslationService,
    private readonly aiService: AIService
  ) {}

  @Get("translate/cards")
  @ApiOperation({ summary: "Translate cards" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "sourceLanguage",
    required: false,
    enum: AppLanguage,
    description: "Source language of the cards",
  })
  @ApiResponse({
    status: 200,
    description: "Cards translated successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async translateCards(@Query("limit") limit: number, @Query("sourceLanguage") sourceLanguage: AppLanguage) {
    return this.translationService.fillMissingTranslations(limit, sourceLanguage);
  }

  @Get("translate/categories")
  @ApiOperation({ summary: "Translate categories" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({
    name: "sourceLanguage",
    required: false,
    enum: AppLanguage,
    description: "Source language of the categories",
  })
  @ApiResponse({
    status: 200,
    description: "Categories translated successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async translateCategories(@Query("limit") limit: number, @Query("sourceLanguage") sourceLanguage: AppLanguage) {
    return this.translationService.fillMissingCategoryTranslations(limit, sourceLanguage);
  }

  @Post("create-game")
  @ApiOperation({ summary: "Start a new game" })
  @ApiResponse({
    status: 200,
    description: "Game started successfully",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - Admin access required",
  })
  async startGame(@Body("description") description: any, @CurrentUser() user: CurrentUserData) {
    return this.aiService.createCustomGame(description, user.id);
  }
}
