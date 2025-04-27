import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose } from 'class-transformer';
import { Suggestion } from '../entities/suggestion.entity';
import { CategoryResponseDto } from '../../categories/dto/category-response.dto';
import { Optional } from '@nestjs/common';
import { UserResponseDto } from '../../users/dto/user-response.dto';

@Exclude()
export class SuggestionResponseDto {
  @Expose()
  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  id: string;

  @Expose()
  @ApiProperty()
  @Optional()
  category?: CategoryResponseDto;

  @Expose()
  @ApiProperty({
    example: 'What is your deepest fear?',
    required: true
  })
  question: string;

  @Expose()
  @ApiProperty()
  user: UserResponseDto;

  @Expose()
  @ApiProperty({ example: '2023-01-01T00:00:00.000Z' })
  createdAt: Date;

  constructor(partial: Partial<Suggestion>) {
    Object.assign(this, partial);
  }
}
