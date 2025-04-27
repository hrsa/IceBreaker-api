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
import { CardLanguage } from '../cards/entities/card.entity';

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
    enum: CardLanguage,
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
    @Query('sourceLanguage') sourceLanguage: CardLanguage,
  ) {
    return this.translationService.fillMissingTranslations(
      limit,
      sourceLanguage,
    );
  }
}
