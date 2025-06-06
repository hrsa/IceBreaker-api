import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";

@Injectable()
export class EmailTemplatesService {
  private readonly defaultFrom: string;
  private readonly appUrl: string;
  private readonly logoUrl: string;
  private readonly adminEmail: string;
  private readonly primaryColor: string = "#4F86F7";
  private readonly secondaryColor: string = "#333333";
  private readonly backgroundColor: string = "#f7f7f9";

  constructor(private configService: ConfigService) {
    this.defaultFrom = this.configService.get<string>("EMAIL_FROM") || "Ice Melter <noreply@icemelter.app>";
    this.appUrl = this.configService.get<string>("APP_URL") || "https://icemelter.app";
    this.logoUrl = this.configService.get<string>("LOGO_URL") || "https://icemelter.app/logo.png";
    this.adminEmail = this.configService.get<string>("ADMIN_EMAIL") || "anton@anton.eco";
  }

  private getBaseTemplate(content: string, title: string) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${title}</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            margin: 0;
            padding: 0;
            background-color: ${this.backgroundColor};
            color: #333;
            line-height: 1.6;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            padding: 30px 0 20px;
            border-bottom: 1px solid #eee;
          }
          .logo-container {
            display: inline-block;
            width: 120px;
            height: 120px;
            border-radius: 60px;
            overflow: hidden;
            background-color: white;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            padding: 5px;
            border: 3px solid ${this.primaryColor};
          }
          .logo {
            width: 100%;
            height: 100%;
            object-fit: cover;
            border-radius: 60px;
          }
          .content {
            padding: 30px 20px;
            text-align: center;
          }
          .footer {
            text-align: center;
            padding: 20px;
            font-size: 12px;
            color: #999;
            border-top: 1px solid #eee;
          }
          h1 {
            color: ${this.primaryColor};
            font-size: 24px;
            margin-bottom: 20px;
          }
          p {
            margin-bottom: 16px;
            font-size: 16px;
          }
          .button {
            display: inline-block;
            padding: 12px 24px;
            background-color: ${this.primaryColor};
            color: white !important;
            text-decoration: none;
            border-radius: 4px;
            font-weight: bold;
            margin: 20px 0;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
          }
          .button:hover {
            background-color: #3a6bc5;
          }
          .note {
            font-size: 14px;
            color: #777;
            margin-top: 30px;
          }
          .social {
            margin-top: 20px;
          }
          .social a {
            display: inline-block;
            margin: 0 8px;
            color: ${this.primaryColor};
            text-decoration: none;
          }
          .social a:hover {
            text-decoration: underline;
          }
          .app-name {
            margin-top: 10px;
            font-size: 18px;
            font-weight: bold;
            color: ${this.primaryColor};
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <a href="${this.appUrl}" target="_blank">
              <div class="logo-container">
                <img src="${this.logoUrl}" alt="Ice Melter Logo" class="logo">
              </div>
            </a>
            <div class="app-name">Ice Melter</div>
          </div>
          <div class="content">
            ${content}
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Ice Melter. All rights reserved.</p>
            <p>If you have any questions, please contact me at <a href="mailto:${this.adminEmail}" style="color: ${this.primaryColor};">${this.adminEmail}</a></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  getPasswordResetTemplate(resetLink: string) {
    const content = `
      <h1>Reset Your Password</h1>
      <p>You have requested to reset your password for your IceMelter account.</p>
      <p>Click the button below to set a new password:</p>
      <a href="${resetLink}" class="button">Reset Password</a>
      <p class="note">If you didn't request a password reset, please ignore this email or contact support if you have concerns about your account security.</p>
    `;

    return {
      from: this.defaultFrom,
      subject: "Reset Your IceMelter Password",
      html: this.getBaseTemplate(content, "Reset Your Password"),
    };
  }

  getWelcomeTemplate(confirmLink: string, name?: string) {
    const content = `
      <h1>${name ? `Welcome, ${name}!` : "Welcome to Ice Melter!"}</h1>
      <p>Thank you for joining Ice Melter. We're excited to have you on board!</p>
      <p>Ice Melter helps you break the ice and start conversations with confidence.</p>
      <p>Please confirm your email address by clicking the button below:</p>
      <a href="${confirmLink}" class="button">Confirm Email</a>
      <p class="note">If you didn't create an account with us, you can safely ignore this email.</p>
    `;

    return {
      from: this.defaultFrom,
      subject: name ? `Welcome to Ice Melter, ${name}!` : "Welcome to Ice Melter!",
      html: this.getBaseTemplate(content, "Welcome to Ice Melter"),
    };
  }

  getConnectTelegramTemplate(tgLink: string) {
    const content = `
      <h1>Connect Your Telegram Account</h1>
      <p>Take Ice Melter with you on the go by connecting your Telegram account!</p>
      <p>With our Telegram bot, you can access conversation starters anytime, anywhere.</p>
      <p>Click the button below to connect your account:</p>
      <a href="${tgLink}" class="button">Connect Telegram</a>
      <p class="note">This link is valid for 24 hours. If you didn't request to connect Telegram, you can safely ignore this email.</p>
    `;

    return {
      from: this.defaultFrom,
      subject: "Connect Your Telegram Account - Ice Melter",
      html: this.getBaseTemplate(content, "Connect Telegram - Ice Melter"),
    };
  }
}
