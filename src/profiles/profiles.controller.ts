import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  ClassSerializerInterceptor,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { ProfilesService } from "./profiles.service";
import { CreateProfileDto } from "./dto/create-profile.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ProfileResponseDto } from "./dto/profile-response.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { CurrentUserData } from '../auth/strategies/jwt.strategy';

@ApiTags("profiles")
@Controller("profiles")
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
export class ProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Post()
  @ApiOperation({ summary: "Create a new profile" })
  @ApiResponse({
    status: 201,
    description: "Profile created successfully",
    type: ProfileResponseDto,
  })
  async create(@Body() createProfileDto: CreateProfileDto, @CurrentUser() currentUser: CurrentUserData): Promise<ProfileResponseDto> {
    if (!createProfileDto.userId || !currentUser.isAdmin) {
      createProfileDto.userId = currentUser.id;
    }

    const profile = await this.profilesService.create(createProfileDto);
    return new ProfileResponseDto(profile);
  }

  @Get()
  @ApiOperation({ summary: "Get all profiles for the current user" })
  @ApiResponse({
    status: 200,
    description: "Return all profiles for the user",
    type: [ProfileResponseDto],
  })
  async findAll(@CurrentUser("id") userId: string): Promise<ProfileResponseDto[]> {
    const profiles = await this.profilesService.findAll(userId);
    return profiles.map(profile => new ProfileResponseDto(profile));
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a profile by ID" })
  @ApiResponse({
    status: 200,
    description: "Return the profile",
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: "Profile not found" })
  async findOne(@Param("id") id: string, @CurrentUser() currentUser: CurrentUserData): Promise<ProfileResponseDto> {
    const profile = await this.profilesService.findOne(id, currentUser.id, currentUser.isAdmin);
    return new ProfileResponseDto(profile);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a profile" })
  @ApiResponse({
    status: 200,
    description: "Profile updated successfully",
    type: ProfileResponseDto,
  })
  @ApiResponse({ status: 404, description: "Profile not found" })
  async update(
    @Param("id") id: string,
    @Body() updateProfileDto: UpdateProfileDto,
    @CurrentUser() currentUser: CurrentUserData
  ): Promise<ProfileResponseDto> {
    if (updateProfileDto.userId) {
      delete updateProfileDto.userId;
    }

    const profile = await this.profilesService.update(id, currentUser.id, updateProfileDto, currentUser.isAdmin);
    return new ProfileResponseDto(profile);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a profile" })
  @ApiResponse({ status: 204, description: "Profile deleted successfully" })
  @ApiResponse({ status: 404, description: "Profile not found" })
  async remove(@Param("id") id: string, @CurrentUser() currentUser: CurrentUserData): Promise<void> {
    return this.profilesService.remove(id, currentUser.id, currentUser.isAdmin);
  }

  @Get(":id/card-preferences")
  @ApiOperation({ summary: "Get all card preferences for a profile" })
  @ApiResponse({
    status: 200,
    description: "Return all card preferences for the profile",
  })
  async getCardPreferences(
    @Param("id") profileId: string,
    @CurrentUser("id") userId: string,
    @Query("status") status?: string
  ) {
    return this.profilesService.getCardPreferences(profileId, status, userId);
  }
}
