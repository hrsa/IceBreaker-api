import { IsEnum, IsNotEmpty } from 'class-validator';
import { CardStatus } from '../entitites/card-preference.entity';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateCardPreferenceDto {
  @ApiProperty({
    enum: CardStatus,
    example: CardStatus.ACTIVE,
    description: 'The status of the card for this profile'
  })
  @IsNotEmpty()
  @IsEnum(CardStatus)
  status: CardStatus;
}
