import { Body, Controller, HttpCode, Logger, Post } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { WebhooksService } from "./webhooks.service";
import { KofiWebhookPayload } from "./interfaces/kofi.interface";

@ApiTags("Webhooks")
@Controller("webhooks")
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private readonly webhooksService: WebhooksService) {}

  @Post("ko-fi")
  @HttpCode(200)
  @ApiOperation({ summary: "Ko-fi donations webhook" })
  @ApiResponse({
    status: 200,
    description: "Webhook received",
  })
  koFiWebhook(@Body("data") data: string) {
    try {
      const parsedData = JSON.parse(data) as KofiWebhookPayload;
      return this.webhooksService.processKofiWebhook(parsedData);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error processing Ko-fi webhook: ${error.message}`, error.stack);
      }
      return { success: false, message: "Error processing webhook" };
    }
  }
}
