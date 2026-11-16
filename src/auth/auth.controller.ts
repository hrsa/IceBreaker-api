import { Controller, Post, UseGuards, Body, HttpCode, HttpStatus, ClassSerializerInterceptor, UseInterceptors } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { LoginDto } from "./dto/login.dto";
import { CreateUserDto } from "../users/dto/create-user.dto";
import { UsersService } from "../users/users.service";
import { UserResponseDto } from "../users/dto/user-response.dto";
import { TokenDto } from "./dto/token.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentUserData } from "./strategies/jwt.strategy";

@ApiTags("auth")
@Controller("auth")
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService
  ) {}

  @Post("register")
  @ApiOperation({ summary: "Register a new user" })
  @ApiResponse({ status: 201, description: "User registered successfully", type: UserResponseDto })
  @ApiResponse({ status: 400, description: "Bad request" })
  async register(@Body() createUserDto: CreateUserDto): Promise<UserResponseDto> {
    const user = await this.usersService.create(createUserDto);
    return new UserResponseDto(user);
  }

  @Post("login")
  @UseGuards(LocalAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login with credentials" })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: "Login successful", type: TokenDto })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async login(@CurrentUser() user: CurrentUserData): Promise<TokenDto> {
    return this.authService.login(user);
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Exchange a refresh token for a new token pair" })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: "New token pair issued", type: TokenDto })
  @ApiResponse({ status: 401, description: "Invalid, expired or revoked refresh token" })
  async refresh(@Body() body: RefreshTokenDto): Promise<TokenDto> {
    return this.authService.refresh(body.refreshToken);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Revoke the session family of a refresh token" })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: "Logout successful" })
  async logout(@Body() body: RefreshTokenDto): Promise<{ message: string }> {
    await this.authService.logout(body.refreshToken);
    return { message: "Logged out" };
  }

  @Post("password/forgot")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Request password reset" })
  @ApiBody({ description: "Email of the user" })
  async requestResetPassword(@Body() body: { email: string }) {
    await this.authService.requestPasswordReset(body.email);
    return {
      message: "If you have an account, you will receive a link to reset your password via email.",
    };
  }

  @Post("password/reset")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Reset password" })
  @ApiBody({ description: "New password in body and token in the query" })
  async resetPassword(@Body() body: { password: string; token: string }) {
    await this.authService.resetPassword(body.token, body.password);
    return {
      message: "Your password has been reset. You can now log in.",
    };
  }
}
