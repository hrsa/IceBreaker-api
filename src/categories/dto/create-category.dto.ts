import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
  @ApiProperty({
    example: 'Ice Breakers',
    description: 'The name of the category',
  })
  @IsString()
  @IsNotEmpty({ message: 'Category name is required' })
  @MaxLength(140, { message: 'Category name cannot exceed 100 characters' })
  name: string;

  @ApiProperty({
    example: 'Questions to break the ice in social gatherings',
    description: 'A description of the category',
    required: false,
  })
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  description?: string;
}