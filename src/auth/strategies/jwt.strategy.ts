import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../../users/users.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private configService: ConfigService, private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET', 'secretjwtkey'),
    });
  }

  async validate(payload: any): Promise<CurrentUserData> {
    try {
      const user = await this.usersService.findOne(payload.sub);

      if (!user.isActivated) {
        throw new UnauthorizedException('User is not activated');
      }

      return { id: payload.sub, email: payload.email, isAdmin: user.isAdmin };
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

export interface CurrentUserData {
  id: string;
  email: string;
  isAdmin: boolean;
}
