import { Injectable, Logger } from "@nestjs/common";
import { KofiPaymentType, KofiWebhookPayload } from "./interfaces/kofi.interface";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DonationReceivedEvent } from "./events/donation-received.event";

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly configService: ConfigService,
    private eventEmitter: EventEmitter2
  ) {}

  async processKofiWebhook(payload: KofiWebhookPayload) {
    this.logger.log(`Processing Ko-fi webhook: ${payload.type} from ${payload.from_name}`);

    if (payload.verification_token !== this.configService.getOrThrow("KOFI_VERIFICATION_TOKEN")) {
      this.logger.warn("Invalid verification token in Ko-fi webhook");
      return { success: false, message: "Invalid verification token" };
    }

    switch (payload.type) {
      case KofiPaymentType.DONATION:
      case KofiPaymentType.SUBSCRIPTION:
        return this.processDonation(payload);

      default:
        this.logger.warn(`Unhandled Ko-fi payment type: ${payload.type}`);
        return { success: true, message: "Webhook received but payment type not handled" };
    }
  }

  private processDonation(payload: KofiWebhookPayload) {
    this.logger.log(`Got donation from ${payload.email}`);
    this.eventEmitter.emit("donation.received", new DonationReceivedEvent(parseInt(payload.amount), payload.email));
  }
}
