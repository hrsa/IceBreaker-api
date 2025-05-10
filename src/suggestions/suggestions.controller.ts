import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, UseInterceptors, ClassSerializerInterceptor } from "@nestjs/common";
import { SuggestionsService } from "./suggestions.service";
import { CreateSuggestionDto } from "./dto/create-suggestion.dto";
import { UpdateSuggestionDto } from "./dto/update-suggestion.dto";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { SuggestionResponseDto } from "./dto/suggestion-response.dto";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AdminGuard } from "../common/guards/admin.guard";
import { CurrentUserData } from "../auth/strategies/jwt.strategy";

@ApiTags("suggestions")
@Controller("suggestions")
@UseGuards(JwtAuthGuard)
@UseInterceptors(ClassSerializerInterceptor)
@ApiBearerAuth()
export class SuggestionsController {
  constructor(private readonly suggestionsService: SuggestionsService) {}

  @Post()
  @ApiOperation({ summary: "Create a new suggestion" })
  @ApiResponse({
    status: 201,
    description: "Suggestion created successfully",
    type: SuggestionResponseDto,
  })
  async create(@Body() createSuggestionDto: CreateSuggestionDto, @CurrentUser("id") userId: string) {
    createSuggestionDto.userId = userId;
    const suggestion = await this.suggestionsService.create(createSuggestionDto);
    return new SuggestionResponseDto(suggestion);
  }

  @Get()
  @ApiOperation({ summary: "Find all suggestions for the current user" })
  @ApiResponse({
    status: 200,
    description: "Return all suggestions for the user",
    type: [SuggestionResponseDto],
  })
  async findAll(@CurrentUser("id") userId: string) {
    const suggestions = await this.suggestionsService.findAll(userId);
    return suggestions.map(suggestion => new SuggestionResponseDto(suggestion));
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a suggestion by ID" })
  @ApiResponse({
    status: 200,
    description: "Return the suggestion",
    type: SuggestionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Suggestion not found" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin access required" })
  async findOne(@Param("id") id: string, @CurrentUser() user: CurrentUserData) {
    return this.suggestionsService.findOne(id, user.id, user.isAdmin);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a suggestion" })
  @UseGuards(AdminGuard)
  @ApiResponse({
    status: 200,
    description: "Suggestion updated successfully",
    type: SuggestionResponseDto,
  })
  @ApiResponse({ status: 404, description: "Suggestion not found" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin access required" })
  async update(@Param("id") id: string, @Body() updateSuggestionDto: UpdateSuggestionDto) {
    return this.suggestionsService.update(id, updateSuggestionDto);
  }

  @Delete(":id")
  @ApiOperation({ summary: "Delete a suggestion" })
  @UseGuards(AdminGuard)
  @ApiResponse({ status: 204, description: "Suggestion deleted successfully" })
  @ApiResponse({ status: 404, description: "Suggestion not found" })
  @ApiResponse({ status: 403, description: "Forbidden - Admin access required" })
  remove(@Param("id") id: string) {
    return this.suggestionsService.remove(id);
  }
}
