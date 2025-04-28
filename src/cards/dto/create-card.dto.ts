import { IsEnum, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AppLanguage } from '../../common/constants/app-language.enum';

export class CreateCardDto {
  @ApiProperty({
    example: 'If you could have dinner with any historical figure, who would it be and why?',
    description: 'The main content of the card',
  })
  @IsString()
  @IsNotEmpty({ message: 'Card content is required' })
  @MaxLength(1000, { message: 'Content cannot exceed 1000 characters' })
  question: string;

  @ApiProperty({
    example: 'en',
    description: 'The language of the question',
  })
  @IsEnum(AppLanguage)
  @IsNotEmpty({ message: 'Language is required' })
  language: AppLanguage;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The ID of the category this card belongs to',
  })
  @IsUUID()
  @IsNotEmpty({ message: 'Category ID is required' })
  categoryId: string;
}
