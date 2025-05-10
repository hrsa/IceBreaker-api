import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { CardsService } from "./cards.service";
import { CreateCardDto } from "./dto/create-card.dto";
import { UpdateCardDto } from "./dto/update-card.dto";
import { CardResponseDto } from "./dto/card-response.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "../common/guards/admin.guard";
import { GetRandomCardDto } from "./dto/get-random-card.dto";
import { CurrentUserData } from "../auth/strategies/jwt.strategy";
import { CurrentUser } from "../common/decorators/current-user.decorator";

@ApiTags("cards")
@Controller("cards")
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
export class CardsController {
  constructor(private readonly cardsService: CardsService) {}

  @Post()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: "Create a new card (Admin only)" })
  @ApiResponse({
    status: 201,
    description: "Card created successfully",
    type: CardResponseDto,
  })
  @ApiResponse({ status: 403, description: "Forbidden - Admin access required" })
  async create(@Body() createCardDto: CreateCardDto): Promise<CardResponseDto> {
    const card = await this.cardsService.create(createCardDto);
    return new CardResponseDto(card);
  }

  @Get()
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: "Get all cards" })
  @ApiQuery({ name: "categoryId", required: false, type: String })
  @ApiResponse({
    status: 200,
    description: "Return all cards",
    type: [CardResponseDto],
  })
  async findAll(@Query("categoryId") categoryId?: string): Promise<CardResponseDto[]> {
    const cards = await this.cardsService.findAll(categoryId);
    return cards.map(card => new CardResponseDto(card));
  }

  @Post("random")
  @ApiOperation({ summary: "Get random cards from one or multiple categories" })
  @HttpCode(200)
  @ApiResponse({
    status: 200,
    description: "Return a random card",
    type: [CardResponseDto],
  })
  async getRandom(
    @Body() getRandomCardDto: GetRandomCardDto,
    @CurrentUser() user: CurrentUserData
  ): Promise<{
    cards: CardResponseDto[];
    hasViewedAllCards: boolean;
  }> {
    const cards = await this.cardsService.getRandomCard(getRandomCardDto, user.id);
    const hasViewedAllCards = await this.cardsService.hasOnlyLovedCardsLeft(getRandomCardDto);
    return {
      cards: cards.map(card => new CardResponseDto(card)),
      hasViewedAllCards: hasViewedAllCards,
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a card by ID" })
  @ApiResponse({
    status: 200,
    description: "Return the card",
    type: CardResponseDto,
  })
  @ApiResponse({ status: 404, description: "Card not found" })
  async findOne(@Param("id") id: string): Promise<CardResponseDto> {
    const card = await this.cardsService.findOne(id);
    return new CardResponseDto(card);
  }

  @Patch(":id")
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: "Update a card (Admin only)" })
  @ApiResponse({
    status: 200,
    description: "Card updated successfully",
    type: CardResponseDto,
  })
  @ApiResponse({ status: 403, description: "Forbidden - Admin access required" })
  @ApiResponse({ status: 404, description: "Card not found" })
  async update(@Param("id") id: string, @Body() updateCardDto: UpdateCardDto): Promise<CardResponseDto> {
    const card = await this.cardsService.update(id, updateCardDto);
    return new CardResponseDto(card);
  }

  @Delete(":id")
  @UseGuards(AdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a card (Admin only)" })
  @ApiResponse({ status: 204, description: "Card deleted successfully" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin access required" })
  @ApiResponse({ status: 404, description: "Card not found" })
  async remove(@Param("id") id: string): Promise<void> {
    return this.cardsService.remove(id);
  }
}
