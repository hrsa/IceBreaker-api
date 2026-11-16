import { ApiProperty } from "@nestjs/swagger";

export class TokenDto {
  @ApiProperty({
    example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    description: "JWT access token",
  })
  accessToken: string;

  @ApiProperty({
    example: "dBU0Z4qX1L2hpfJ8c9OQbC7...",
    description: "Opaque refresh token; rotate by calling /auth/refresh",
  })
  refreshToken: string;
}
