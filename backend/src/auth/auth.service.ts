import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import { UsersService } from '../users/users.service';

type SanitizedUser = Omit<User, 'password'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<SanitizedUser> {
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password: _password, ...safeUser } = user;
    void _password;
    return safeUser;
  }

  login(user: SanitizedUser) {
    const payload = {
      sub: user.id,
      role: user.role,
      tenantId: user.tenantId ?? null,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
