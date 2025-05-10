import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  UseGuards,
  Query,
  Post,
  UseInterceptors,
  ClassSerializerInterceptor,
  HttpStatus,
  HttpException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CardPreferencesService } from "./card-preferences.service";
import { UpdateCardPreferenceDto } from "./dto/update-card-preference.dto";
import { CardPreferenceResponseDto } from "./dto/card-preference-response.dto";
import { CardStatus } from "./entitites/card-preference.entity";
import { ProfileOwnerGuard } from "../common/guards/profile-owner.guard";
import { Response } from "express";

@ApiTags("card-preferences")
@Controller("card-preferences")
@UseGuards(JwtAuthGuard, ProfileOwnerGuard)
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
export class CardPreferencesController {
  constructor(private readonly preferencesService: CardPreferencesService) {}

  @Get()
  @ApiOperation({ summary: "Get all card preferences for a profile" })
  @ApiQuery({ name: "profileId", required: true, type: String })
  @ApiQuery({
    name: "status",
    required: false,
    enum: CardStatus,
    description: "Filter by card status",
  })
  @ApiResponse({
    status: 200,
    description: "Return all preferences for the profile",
    type: [CardPreferenceResponseDto],
  })
  async findAll(@Query("profileId") profileId: string, @Query("status") status?: CardStatus): Promise<CardPreferenceResponseDto[]> {
    const preferences = await this.preferencesService.findAll(profileId, status);
    return preferences.map(pref => new CardPreferenceResponseDto(pref));
  }

  @Get("active")
  @ApiOperation({ summary: "Get all active cards for a profile" })
  @ApiQuery({ name: "profileId", required: true, type: String })
  @ApiResponse({
    status: 200,
    description: "Return active cards for the profile",
    type: [CardPreferenceResponseDto],
  })
  async getActiveCards(@Query("profileId") profileId: string): Promise<CardPreferenceResponseDto[]> {
    const preferences = await this.preferencesService.getActiveCardsForProfile(profileId);
    return preferences.map(pref => new CardPreferenceResponseDto(pref));
  }

  @Get("archived")
  @ApiOperation({ summary: "Get all archived cards for a profile" })
  @ApiQuery({ name: "profileId", required: true, type: String })
  @ApiResponse({
    status: 200,
    description: "Return archived cards for the profile",
    type: [CardPreferenceResponseDto],
  })
  async getArchivedCards(@Query("profileId") profileId: string): Promise<CardPreferenceResponseDto[]> {
    const preferences = await this.preferencesService.getArchivedCardsForProfile(profileId);
    return preferences.map(pref => new CardPreferenceResponseDto(pref));
  }

  @Get("banned")
  @ApiOperation({ summary: "Get all banned cards for a profile" })
  @ApiQuery({ name: "profileId", required: true, type: String })
  @ApiResponse({
    status: 200,
    description: "Return banned cards for the profile",
    type: [CardPreferenceResponseDto],
  })
  async getBannedCards(@Query("profileId") profileId: string): Promise<CardPreferenceResponseDto[]> {
    const preferences = await this.preferencesService.getBannedCardsForProfile(profileId);
    return preferences.map(pref => new CardPreferenceResponseDto(pref));
  }

  @Get("loved")
  @ApiOperation({ summary: "Get all banned cards for a profile" })
  @ApiQuery({ name: "profileId", required: true, type: String })
  @ApiResponse({
    status: 200,
    description: "Return banned cards for the profile",
    type: [CardPreferenceResponseDto],
  })
  async getLovedCards(@Query("profileId") profileId: string): Promise<CardPreferenceResponseDto[]> {
    const preferences = await this.preferencesService.getLovedCardsForProfile(profileId);
    return preferences.map(pref => new CardPreferenceResponseDto(pref));
  }

  @Put(":cardId/profile/:profileId")
  @ApiOperation({ summary: "Update a card preference for a profile" })
  @ApiResponse({
    status: 200,
    description: "Preference updated successfully",
    type: CardPreferenceResponseDto,
  })
  @ApiResponse({ status: 204, description: "Preference deleted successfully" })
  @ApiResponse({ status: 404, description: "Card or profile not found" })
  async updatePreference(
    @Param("cardId") cardId: string,
    @Param("profileId") profileId: string,
    @Body() updateDto: UpdateCardPreferenceDto
  ): Promise<CardPreferenceResponseDto | Response> {
    const preference = await this.preferencesService.updatePreference(cardId, profileId, updateDto);
    if (preference) {
      return new CardPreferenceResponseDto(preference);
    }
    throw new HttpException("Card reactivated successfully.", HttpStatus.NO_CONTENT);
  }

  @Post(":cardId/profile/:profileId/archive")
  @ApiOperation({ summary: "Archive a card for a profile" })
  @ApiResponse({
    status: 200,
    description: "Card archived successfully",
    type: CardPreferenceResponseDto,
  })
  @ApiResponse({ status: 404, description: "Card or profile not found" })
  async archiveCard(@Param("cardId") cardId: string, @Param("profileId") profileId: string): Promise<CardPreferenceResponseDto> {
    const preference = await this.preferencesService.archiveCard(cardId, profileId);
    if (preference) {
      return new CardPreferenceResponseDto(preference);
    } else throw new HttpException("Can't archive the card.", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @Post(":cardId/profile/:profileId/reactivate")
  @ApiOperation({ summary: "Reactivate a card for a profile" })
  @ApiResponse({
    status: 200,
    description: "Card reactivated successfully",
    type: CardPreferenceResponseDto,
  })
  @ApiResponse({ status: 404, description: "Card or profile not found" })
  async reactivateCard(@Param("cardId") cardId: string, @Param("profileId") profileId: string): Promise<Response> {
    await this.preferencesService.reactivateCard(cardId, profileId);
    throw new HttpException("Card reactivated successfully.", HttpStatus.NO_CONTENT);
  }

  @Post(":cardId/profile/:profileId/ban")
  @ApiOperation({ summary: "Ban a card for a profile" })
  @ApiResponse({
    status: 200,
    description: "Card banned successfully",
    type: CardPreferenceResponseDto,
  })
  @ApiResponse({ status: 404, description: "Card or profile not found" })
  async banCard(@Param("cardId") cardId: string, @Param("profileId") profileId: string): Promise<CardPreferenceResponseDto> {
    const preference = await this.preferencesService.banCard(cardId, profileId);
    if (preference) {
      return new CardPreferenceResponseDto(preference);
    } else throw new HttpException("Can't ban the card.", HttpStatus.INTERNAL_SERVER_ERROR);
  }

  @Post(":cardId/profile/:profileId/love")
  @ApiOperation({ summary: "Love a card for a profile" })
  @ApiResponse({
    status: 200,
    description: "Card added to loved successfully",
    type: CardPreferenceResponseDto,
  })
  @ApiResponse({ status: 404, description: "Card or profile not found" })
  async loveCard(@Param("cardId") cardId: string, @Param("profileId") profileId: string): Promise<CardPreferenceResponseDto> {
    const preference = await this.preferencesService.loveCard(cardId, profileId);
    if (preference) {
      return new CardPreferenceResponseDto(preference);
    } else throw new HttpException("Can't love the card.", HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
