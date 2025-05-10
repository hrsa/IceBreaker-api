import { IsNotEmpty, IsOptional, IsString, IsUUID } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateProfileDto {
  @ApiProperty({
    example: "Family Group",
    description: "The name of the profile",
  })
  @IsString()
  @IsNotEmpty({ message: "Profile name is required" })
  name: string;

  @ApiProperty({
    example: "123e4567-e89b-12d3-a456-426614174000",
    description: "The ID of the user who owns this profile",
  })
  @IsUUID()
  @IsOptional()
  userId?: string;
}
