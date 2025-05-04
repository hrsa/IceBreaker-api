import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class CreateUserDto {
  @ApiProperty({
    example: "user@example.com",
    description: "The user email address",
  })
  @IsEmail({}, { message: "Provide a valid email" })
  @IsNotEmpty({ message: "Email is required" })
  email: string;

  @ApiProperty({
    example: "password123",
    description: "The password of the user",
  })
  @IsString()
  @MinLength(6, { message: "Password must be at least 6 characters long" })
  password: string;

  @ApiProperty({
    example: "John Doe",
    description: "The name of the user",
  })
  @IsString()
  @IsNotEmpty({ message: "Name cannot be empty" })
  name: string;

  @ApiProperty({
    example: "123456789",
    description: "The telegram id of the user",
  })
  @IsOptional()
  @IsNumber()
  telegramId: number;
}
