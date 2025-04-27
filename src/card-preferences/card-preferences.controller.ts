// src/card-preferences/card-preferences.controller.ts
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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CardPreferencesService } from './card-preferences.service';
import { UpdateCardPreferenceDto } from './dto/update-card-preference.dto';
import { CardPreferenceResponseDto } from './dto/card-preference-response.dto';
import { CardStatus } from './entitites/card-preference.entity';
import { ProfileOwnerGuard } from '../common/guards/profile-owner.guard';

@ApiTags('card-preferences')
@Controller('card-preferences')
@UseGuards(JwtAuthGuard, ProfileOwnerGuard)
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
export class CardPreferencesController {
  constructor(private readonly preferencesService: CardPreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all card preferences for a profile' })
  @ApiQuery({ name: 'profileId', required: true, type: String })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: CardStatus,
    description: 'Filter by card status'
  })
  @ApiResponse({
    status: 200,
    description: 'Return all preferences for the profile',
    type: [CardPreferenceResponseDto]
  })
  async findAll(
    @Query('profileId') profileId: string,
    @Query('status') status?: CardStatus
  ): Promise<CardPreferenceResponseDto[]> {
    const preferences = await this.preferencesService.findAll(profileId, status);
    return preferences.map(pref => new CardPreferenceResponseDto(pref));
  }

  @Get('active')
  @ApiOperation({ summary: 'Get all active cards for a profile' })
  @ApiQuery({ name: 'profileId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Return active cards for the profile',
    type: [CardPreferenceResponseDto]
  })
  async getActiveCards(
    @Query('profileId') profileId: string
  ): Promise<CardPreferenceResponseDto[]> {
    const preferences = await this.preferencesService.getActiveCardsForProfile(profileId);
    return preferences.map(pref => new CardPreferenceResponseDto(pref));
  }

  @Get('archived')
  @ApiOperation({ summary: 'Get all archived cards for a profile' })
  @ApiQuery({ name: 'profileId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Return archived cards for the profile',
    type: [CardPreferenceResponseDto]
  })
  async getArchivedCards(
    @Query('profileId') profileId: string
  ): Promise<CardPreferenceResponseDto[]> {
    const preferences = await this.preferencesService.getArchivedCardsForProfile(profileId);
    return preferences.map(pref => new CardPreferenceResponseDto(pref));
  }

  @Get('banned')
  @ApiOperation({ summary: 'Get all banned cards for a profile' })
  @ApiQuery({ name: 'profileId', required: true, type: String })
  @ApiResponse({
    status: 200,
    description: 'Return banned cards for the profile',
    type: [CardPreferenceResponseDto]
  })
  async getBannedCards(
    @Query('profileId') profileId: string
  ): Promise<CardPreferenceResponseDto[]> {
    const preferences = await this.preferencesService.getBannedCardsForProfile(profileId);
    return preferences.map(pref => new CardPreferenceResponseDto(pref));
  }

  @Put(':cardId/profile/:profileId')
  @ApiOperation({ summary: 'Update a card preference for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Preference updated successfully',
    type: CardPreferenceResponseDto
  })
  @ApiResponse({ status: 404, description: 'Card or profile not found' })
  async updatePreference(
    @Param('cardId') cardId: string,
    @Param('profileId') profileId: string,
    @Body() updateDto: UpdateCardPreferenceDto
  ): Promise<CardPreferenceResponseDto> {
    const preference = await this.preferencesService.updatePreference(
      cardId,
      profileId,
      updateDto
    );
    return new CardPreferenceResponseDto(preference);
  }

  @Post(':cardId/profile/:profileId/archive')
  @ApiOperation({ summary: 'Archive a card for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Card archived successfully',
    type: CardPreferenceResponseDto
  })
  @ApiResponse({ status: 404, description: 'Card or profile not found' })
  async archiveCard(
    @Param('cardId') cardId: string,
    @Param('profileId') profileId: string,
  ): Promise<CardPreferenceResponseDto> {
    const preference = await this.preferencesService.archiveCard(cardId, profileId);
    return new CardPreferenceResponseDto(preference);
  }

  @Post(':cardId/profile/:profileId/reactivate')
  @ApiOperation({ summary: 'Reactivate a card for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Card reactivated successfully',
    type: CardPreferenceResponseDto
  })
  @ApiResponse({ status: 404, description: 'Card or profile not found' })
  async reactivateCard(
    @Param('cardId') cardId: string,
    @Param('profileId') profileId: string,
  ): Promise<CardPreferenceResponseDto> {
    const preference = await this.preferencesService.reactivateCard(cardId, profileId);
    return new CardPreferenceResponseDto(preference);
  }

  @Post(':cardId/profile/:profileId/ban')
  @ApiOperation({ summary: 'Ban a card for a profile' })
  @ApiResponse({
    status: 200,
    description: 'Card banned successfully',
    type: CardPreferenceResponseDto
  })
  @ApiResponse({ status: 404, description: 'Card or profile not found' })
  async banCard(
    @Param('cardId') cardId: string,
    @Param('profileId') profileId: string,
  ): Promise<CardPreferenceResponseDto> {
    const preference = await this.preferencesService.banCard(cardId, profileId);
    return new CardPreferenceResponseDto(preference);
  }
}