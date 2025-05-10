import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { AppLanguage } from "../../common/constants/app-language.enum";

export class CreateCategoryDto {
  @ApiProperty({
    example: "en",
    description: "The language of the category",
  })
  @IsEnum(AppLanguage)
  @IsNotEmpty({ message: "Language is required" })
  language: AppLanguage;

  @ApiProperty({
    example: "Ice Breakers",
    description: "The name of the category",
  })
  @IsString()
  @IsNotEmpty({ message: "Category name is required" })
  @MaxLength(140, { message: "Category name cannot exceed 140 characters" })
  name: string;

  @ApiProperty({
    example: "Questions to break the ice in social gatherings",
    description: "A description of the category",
    required: false,
  })
  @IsString()
  @IsNotEmpty({ message: "Description is required" })
  @MaxLength(500, { message: "Description cannot exceed 500 characters" })
  description: string;

  @ApiProperty({
    example: true,
    description: "Whether the category is public or not",
  })
  @IsBoolean()
  @IsOptional()
  isPublic: boolean;
}
