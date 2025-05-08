import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { Category } from '../entities/category.entity';

@Exclude()
export class CategoryResponseDto {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Ice Breakers' })
  name_en?: string;

  @Expose()
  @ApiProperty({ example: 'Ice Breakers' })
  name_ru?: string;

  @Expose()
  @ApiProperty({ example: 'Ice Breakers' })
  name_fr?: string;

  @Expose()
  @ApiProperty({ example: 'Ice Breakers' })
  name_it?: string;

  @Expose()
  @ApiProperty({
    example: 'Questions to break the ice in social gatherings',
    required: false
  })
  description_en?: string;

  @Expose()
  @ApiProperty({
    example: 'Questions to break the ice in social gatherings',
    required: false
  })
  description_ru?: string;

  @Expose()
  @ApiProperty({
    example: 'Questions to break the ice in social gatherings',
    required: false
  })
  description_fr?: string;

  @Expose()
  @ApiProperty({
    example: 'Questions to break the ice in social gatherings',
    required: false
  })
  description_it?: string;

  @Expose()
  @ApiProperty({ example: true, required: false })
  isPublic: boolean;

  @Expose()
  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  constructor(partial: Partial<Category>) {
    Object.assign(this, partial);
  }
}
