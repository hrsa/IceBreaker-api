import { ResendService } from "nestjs-resend";
import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { EmailType, PasswordResetData, SendEmailEvent } from "./events/send-email.event";
import { EmailTemplatesService } from "./email-templates.service";

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly resendService: ResendService,
    private readonly templates: EmailTemplatesService
  ) {}

  @OnEvent("send.email")
  async handleSendEmailEvent(event: SendEmailEvent<EmailType>) {
    switch (event.type) {
      case "change-password":
        const { resetLink } = event.data as PasswordResetData;
        await this.sendEmail(event.email, this.templates.getPasswordResetTemplate(resetLink));
        break;
      default:
        this.logger.warn(`Unhandled email type ${event.type} being sent to ${event.email}`);
        break;
    }
  }

  private async sendEmail(to: string, template: { from: string; subject: string; html: string }) {
    await this.resendService.send({
      from: template.from,
      to,
      subject: template.subject,
      html: template.html,
    });

    this.logger.log(`Email sent successfully to ${to}`);
  }
}
