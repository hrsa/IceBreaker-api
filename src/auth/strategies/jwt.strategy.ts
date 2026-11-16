import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { Injectable, Logger, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "../../users/users.service";
import { User } from "../../users/entities/user.entity";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(
    private configService: ConfigService,
    private usersService: UsersService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET", "secretjwtkey"),
    });
  }

  async validate(payload: JwtPayload): Promise<CurrentUserData> {
    let user: User;
    try {
      user = await this.usersService.findOne(payload.sub);
    } catch (error) {
      // A missing user invalidates the token (401). Anything else — driver
      // errors, pool exhaustion, timeouts — must surface as 500 so clients
      // keep the session and retry instead of logging out.
      if (error instanceof NotFoundException) {
        throw new UnauthorizedException("Invalid token");
      }
      throw error;
    }

    if (!user.isActivated) {
      this.logger.warn(`Rejecting deactivated user ${payload.sub}`);
      throw new UnauthorizedException("User is not activated");
    }

    return { id: payload.sub, email: payload.email, isAdmin: user.isAdmin };
  }
}

interface JwtPayload {
  sub: string;
  email: string;
}

export interface CurrentUserData {
  id: string;
  email: string;
  isAdmin: boolean;
}
