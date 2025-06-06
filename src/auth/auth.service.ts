import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import { User } from "../users/entities/user.entity";
import { TokenDto } from "./dto/token.dto";
import { CurrentUserData } from "./strategies/jwt.strategy";
import { Repository } from "typeorm";
import { PasswordReset } from "./entities/password-reset.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PasswordResetData, SendEmailEvent } from "../email/events/send-email.event";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(PasswordReset)
    private resetRepository: Repository<PasswordReset>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2
  ) {}

  async validateUser(email: string, password: string): Promise<User> {
    return this.usersService.validateUser(email, password);
  }

  async login(user: CurrentUserData): Promise<TokenDto> {
    const payload = {
      sub: user.id,
      email: user.email,
    };
    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  private generatePasswordResetToken(): string {
    return this.jwtService.sign({ timestamp: Date.now() }, { expiresIn: "24h", secret: this.configService.get("JWT_SECRET") });
  }

  async requestPasswordReset(email: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent user ${email}`);
      return;
    }

    const token = this.generatePasswordResetToken();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const passwordReset = this.resetRepository.create({ token, userId: user.id, expiresAt });
    await this.resetRepository.save(passwordReset);

    const data = { resetLink: `https://${this.configService.get("HOST")}/password_change?token=${token}` } as PasswordResetData;
    const event = new SendEmailEvent<"change-password">("change-password", user.email, data);

    this.eventEmitter.emit("send.email", event);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetRecord = await this.resetRepository.findOne({
      where: { token, used: false },
    });

    if (!resetRecord || resetRecord.expiresAt < new Date() || resetRecord.used) {
      throw new UnauthorizedException("Invalid or expired reset token");
    }
    await this.usersService.update(resetRecord.userId, { password: newPassword });

    resetRecord.used = true;
    await this.resetRepository.save(resetRecord);
  }
}
