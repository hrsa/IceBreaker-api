import { ApiProperty, PartialType } from "@nestjs/swagger";
import { CreateCardDto } from "./create-card.dto";
import { IsDate, IsOptional } from "class-validator";

export class UpdateCardDto extends PartialType(CreateCardDto) {
  @IsOptional()
  @IsDate()
  @ApiProperty({ example: "2023-01-01T00:00:00.000Z", required: false })
  updatedAt?: Date;
}
