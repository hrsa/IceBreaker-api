import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { Card } from '../entities/card.entity';
import { CategoryResponseDto } from '../../categories/dto/category-response.dto';
import { IsOptional } from 'class-validator';

@Exclude()
export class CardResponseDto {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @Expose()
  @ApiProperty({
    example: 'If you could have dinner with any historical figure, who would it be and why?'
  })
  @IsOptional()
  question_en: string;

  @Expose()
  @ApiProperty({
    example: 'If you could have dinner with any historical figure, who would it be and why?'
  })
  @IsOptional()
  question_ru: string;

  @Expose()
  @ApiProperty({
    example: 'If you could have dinner with any historical figure, who would it be and why?'
  })
  @IsOptional()
  question_fr: string;

  @Expose()
  @ApiProperty({
    example: 'If you could have dinner with any historical figure, who would it be and why?'
  })
  @IsOptional()
  question_it: string;

  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  categoryId: string;

  @Expose()
  @Type(() => CategoryResponseDto)
  @ApiProperty({ type: CategoryResponseDto })
  category?: CategoryResponseDto;

  @Expose()
  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  @Expose()
  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  updatedAt: Date;

  constructor(partial: Partial<Card>) {
    Object.assign(this, partial);
  }
}