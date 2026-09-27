import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { WebhooksService } from "../src/webhooks/webhooks.service";
import { KofiPaymentType, KofiWebhookPayload } from "../src/webhooks/interfaces/kofi.interface";

describe("WebhooksService", () => {
  let service: WebhooksService;
  let configService: { getOrThrow: jest.Mock };
  let eventEmitter: { emit: jest.Mock };

  const validPayload: KofiWebhookPayload = {
    verification_token: "kofi-secret",
    message_id: "m1",
    timestamp: new Date().toISOString(),
    type: KofiPaymentType.DONATION,
    is_public: true,
    from_name: "Donor",
    message: "hi",
    amount: "5",
    url: "",
    email: "donor@test.net",
    currency: "USD",
    is_subscription_payment: false,
    is_first_subscription_payment: false,
    kofi_transaction_id: "t1",
    shop_items: null,
    tier_name: null,
    shipping: null,
  };

  beforeEach(async () => {
    configService = { getOrThrow: jest.fn().mockReturnValue("kofi-secret") };
    eventEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhooksService,
        { provide: ConfigService, useValue: configService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = module.get<WebhooksService>(WebhooksService);
  });

  describe("processKofiWebhook", () => {
    it("emits donation.received with the parsed amount and email for donations", async () => {
      await service.processKofiWebhook(validPayload);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "donation.received",
        expect.objectContaining({ amount: 5, email: "donor@test.net" })
      );
    });

    it("treats subscription payments like donations", async () => {
      await service.processKofiWebhook({
        ...validPayload,
        type: KofiPaymentType.SUBSCRIPTION,
        amount: "12",
      });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        "donation.received",
        expect.objectContaining({ amount: 12 })
      );
    });

    it("rejects a forged verification token without emitting", async () => {
      const result = (await service.processKofiWebhook({
        ...validPayload,
        verification_token: "forged",
      })) as { success: boolean; message: string };

      expect(result.success).toBe(false);
      expect(result.message).toContain("Invalid verification token");
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("acknowledges unhandled payment types without emitting", async () => {
      const result = (await service.processKofiWebhook({
        ...validPayload,
        type: KofiPaymentType.COMMISSION,
      })) as { success: boolean; message: string };

      expect(result.success).toBe(true);
      expect(result.message).toContain("not handled");
      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });

    it("reads the verification token from config", async () => {
      await service.processKofiWebhook(validPayload);

      expect(configService.getOrThrow).toHaveBeenCalledWith("KOFI_VERIFICATION_TOKEN");
    });
  });
});
