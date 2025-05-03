import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Suggestion } from '../entities/suggestion.entity';

export class CreateSuggestionDto {
  @ApiProperty({
    example: 'Family questions',
    description: 'Suggestion category',
  })
  @IsUUID()
  @IsOptional()
  categoryId: string;

  @ApiProperty({
    example: 'What is your deepest fear?',
    description: 'A question to suggest',
    required: true,
  })
  @IsString()
  @IsNotEmpty({ message: 'Question is required' })
  @MaxLength(800, { message: 'Description cannot exceed 800 characters' })
  question: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The ID of the user this suggestion belongs to',
  })
  @IsUUID()
  @IsNotEmpty({ message: 'User ID is required' })
  userId: string;

  constructor(partial: Partial<Suggestion>) {
    Object.assign(this, partial);
  }
}