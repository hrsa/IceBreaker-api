import { ApiProperty, PartialType } from "@nestjs/swagger";
import { CreateSuggestionDto } from "./create-suggestion.dto";
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateSuggestionDto extends PartialType(CreateSuggestionDto) {
  @ApiProperty({
    example: "true",
    description: "Suggestion status",
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  accepted: boolean;
}
