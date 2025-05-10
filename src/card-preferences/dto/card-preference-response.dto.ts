import { ApiProperty } from "@nestjs/swagger";
import { Exclude, Expose, Type } from "class-transformer";
import { CardStatus } from "../entitites/card-preference.entity";
import { CardResponseDto } from "../../cards/dto/card-response.dto";

@Exclude()
export class CardPreferenceResponseDto {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  profileId: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  cardId: string;

  @Expose()
  @ApiProperty({
    enum: CardStatus,
    example: CardStatus.ACTIVE,
  })
  status: CardStatus;

  @Expose()
  @ApiProperty({ example: "2023-01-01T00:00:00.000Z" })
  lastInteractionAt: Date;

  @Expose()
  @Type(() => CardResponseDto)
  @ApiProperty({ type: CardResponseDto })
  card?: CardResponseDto;

  constructor(partial: Partial<any>) {
    Object.assign(this, partial);
  }
}
