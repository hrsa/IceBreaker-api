import {
  IsArray, IsBoolean,
  IsNotEmpty,
  IsNumber, IsOptional,
  IsUUID,

} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GetRandomCardDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: "Player's profile UUID",
  })
  @IsUUID()
  @IsNotEmpty({ message: 'Profile UUID is required' })
  profileId: string;

  @ApiProperty({
    example:
      '["123e4567-e89b-12d3-a456-426614174000", "234r5678-e89b-12d3-a456-426614174000"]',
    description: 'Categories UUIDS',
    type: [String],
    isArray: true,
  })
  @IsArray()
  @IsUUID('all', { each: true, message: 'Category UUIDs are invalid' })
  categoryIds: string[];

  @ApiProperty({
    example: "true",
    description: 'Include archived cards',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  includeArchived: boolean;

  @ApiProperty({
    example: "true",
    description: 'Include loved cards',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  includeLoved: boolean;

  @ApiProperty({
    example: '1',
    description: 'Number of cards to return',
  })
  @IsNumber()
  @IsOptional()
  limit: number;
}
