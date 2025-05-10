import { Controller, Post, UseGuards, Body, HttpCode, HttpStatus, ClassSerializerInterceptor, UseInterceptors } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { LoginDto } from "./dto/login.dto";
import { CreateUserDto } from "../users/dto/create-user.dto";
import { UsersService } from "../users/users.service";
import { UserResponseDto } from "../users/dto/user-response.dto";
import { TokenDto } from "./dto/token.dto";
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

  @UseGuards(LocalAuthGuard)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Login with credentials" })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 200, description: "Login successful", type: TokenDto })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async login(@CurrentUser() user: CurrentUserData): Promise<TokenDto> {
    return this.authService.login(user);
  }
}
