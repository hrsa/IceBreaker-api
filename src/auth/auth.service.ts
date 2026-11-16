import { Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UsersService } from "../users/users.service";
import { User } from "../users/entities/user.entity";
import { TokenDto } from "./dto/token.dto";
import { CurrentUserData } from "./strategies/jwt.strategy";
import { IsNull, Repository } from "typeorm";
import { PasswordReset } from "./entities/password-reset.entity";
import { RefreshToken } from "./entities/refresh-token.entity";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { SendEmailEvent } from "../email/events/send-email.event";
import { createHash, randomBytes, randomUUID } from "node:crypto";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly refreshTtlDays: number;

  constructor(
    @InjectRepository(PasswordReset)
    private resetRepository: Repository<PasswordReset>,
    @InjectRepository(RefreshToken)
    private refreshRepository: Repository<RefreshToken>,
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private eventEmitter: EventEmitter2
  ) {
    // Harden against an unset or malformed REFRESH_TOKEN_TTL_DAYS (e.g. an
    // empty value written by config tooling): never a zero/negative TTL.
    const configuredTtl = parseInt(String(this.configService.get("REFRESH_TOKEN_TTL_DAYS", 365)), 10);
    this.refreshTtlDays = Number.isFinite(configuredTtl) && configuredTtl > 0 ? configuredTtl : 365;
  }

  async validateUser(email: string, password: string): Promise<User> {
    return this.usersService.validateUser(email, password);
  }

  async login(user: CurrentUserData): Promise<TokenDto> {
    const payload = {
      sub: user.id,
      email: user.email,
    };
    const accessToken = this.jwtService.sign(payload);
    const refreshToken = await this.issueRefreshToken(user.id, randomUUID());
    return { accessToken, refreshToken };
  }

  async refresh(rawRefreshToken: string): Promise<TokenDto> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const record = await this.refreshRepository.findOneBy({ tokenHash });

    if (!record || record.revokedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (record.rotatedAt) {
      // This token was already used once → it was replayed. Assume theft of
      // the login chain and revoke every token in its family.
      await this.refreshRepository.update({ familyId: record.familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
      this.logger.warn(`Refresh token reuse detected — family ${record.familyId} of user ${record.userId} revoked`);
      throw new UnauthorizedException("Invalid refresh token");
    }

    const user = await this.getUser(record.userId);
    if (!user.isActivated) {
      this.logger.warn(`Rejecting deactivated user ${user.id} on refresh`);
      throw new UnauthorizedException("User is not activated");
    }

    await this.refreshRepository.update(record.id, { rotatedAt: new Date() });
    const refreshToken = await this.issueRefreshToken(record.userId, record.familyId);

    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email });
    return { accessToken, refreshToken };
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(rawRefreshToken);
    const record = await this.refreshRepository.findOneBy({ tokenHash });
    if (record) {
      await this.refreshRepository.update({ familyId: record.familyId, revokedAt: IsNull() }, { revokedAt: new Date() });
    }
    // Idempotent: an unknown token is a silent no-op — the client clears its
    // local state regardless.
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshRepository.update({ userId, revokedAt: IsNull() }, { revokedAt: new Date() });
  }

  @OnEvent("user.password.changed")
  async onUserPasswordChanged(userId: string) {
    // A password change ends every session issued for this user.
    await this.revokeAllForUser(userId);
  }

  private async getUser(userId: string): Promise<User> {
    try {
      return await this.usersService.findOne(userId);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException("Invalid refresh token");
      }
      throw error;
    }
  }

  private async issueRefreshToken(userId: string, familyId: string): Promise<string> {
    const refreshToken = randomBytes(32).toString("base64url");
    await this.refreshRepository.save({
      tokenHash: this.hashToken(refreshToken),
      familyId,
      userId,
      expiresAt: new Date(Date.now() + this.refreshTtlDays * 24 * 60 * 60 * 1000),
    });
    return refreshToken;
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private generatePasswordResetToken(): string {
    return this.jwtService.sign({ timestamp: Date.now() }, { expiresIn: "24h", secret: this.configService.get("JWT_SECRET") });
  }

  async requestPasswordReset(email: string) {
    let user: User | null = null;
    try {
      user = await this.usersService.findByEmail(email);
    } catch (error) {
      // Same response for unknown emails - prevents account enumeration.
      if (!(error instanceof NotFoundException)) {
        throw error;
      }
    }
    if (!user) {
      this.logger.warn(`Password reset requested for non-existent user ${email}`);
      return;
    }

    const token = this.generatePasswordResetToken();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const passwordReset = this.resetRepository.create({ token, userId: user.id, expiresAt });
    await this.resetRepository.save(passwordReset);

    const data = { resetLink: `https://${this.configService.get("HOST")}/password_change?token=${token}` };
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

    // A password reset ends every session issued for this user.
    await this.revokeAllForUser(resetRecord.userId);
  }
}
