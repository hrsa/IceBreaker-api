// src/profiles/dto/profile-response.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import { Exclude, Expose, Type } from "class-transformer";
import { Profile } from "../entities/profile.entity";
import { CardPreferenceResponseDto } from "../../card-preferences/dto/card-preference-response.dto";

@Exclude()
export class ProfileResponseDto {
  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  id: string;

  @Expose()
  @ApiProperty({ example: "Family Group" })
  name: string;

  @Expose()
  @ApiProperty({ example: "123e4567-e89b-12d3-a456-426614174000" })
  userId: string;

  @Expose()
  @Type(() => CardPreferenceResponseDto)
  @ApiProperty({ type: [CardPreferenceResponseDto] })
  cardPreferences?: CardPreferenceResponseDto[];

  constructor(partial: Partial<Profile>) {
    Object.assign(this, partial);
  }
}
