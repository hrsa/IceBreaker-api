import {
  Controller,
  Get,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { TranslationService } from './translation.service';
import { AppLanguage } from '../common/constants/app-language.enum';

@ApiTags('translations')
@Controller('translations')
@UseGuards(JwtAuthGuard, AdminGuard)
@ApiBearerAuth()
export class TranslationsController {
  constructor(private readonly translationService: TranslationService) {}

  @Get('cards')
  @ApiOperation({ summary: 'Translate cards' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sourceLanguage',
    required: false,
    enum: AppLanguage,
    description: 'Source language of the cards',
  })
  @ApiResponse({
    status: 200,
    description: 'Cards translated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async translateCards(
    @Query('limit') limit: number,
    @Query('sourceLanguage') sourceLanguage: AppLanguage,
  ) {
    return this.translationService.fillMissingTranslations(
      limit,
      sourceLanguage,
    );
  }

  @Get('categories')
  @ApiOperation({ summary: 'Translate categories' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'sourceLanguage',
    required: false,
    enum: AppLanguage,
    description: 'Source language of the categories',
  })
  @ApiResponse({
    status: 200,
    description: 'Categories translated successfully',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async translateCategories(
    @Query('limit') limit: number,
    @Query('sourceLanguage') sourceLanguage: AppLanguage,
  ) {
    return this.translationService.fillMissingCategoryTranslations(
      limit,
      sourceLanguage,
    );
  }
}