import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, type JwtFromRequestFunction } from 'passport-jwt';
import { UsersService } from '../../users/users.service';

interface JwtPayload {
  sub: string;
  role: string;
  tenantId?: string | null;
  tokenVersion?: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new Error('JWT_SECRET is not configured');
    }

    const jwtFromRequest: JwtFromRequestFunction =
      ExtractJwt.fromAuthHeaderAsBearerToken();

    super({
      jwtFromRequest,
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const currentVersion = user.tokenVersion ?? 0;
    const payloadVersion = payload.tokenVersion ?? 0;
    if (currentVersion !== payloadVersion) {
      throw new UnauthorizedException('Token is no longer valid');
    }

    return {
      userId: user.id,
      role: user.role,
      tenantId: user.tenantId ?? null,
    };
  }
}
