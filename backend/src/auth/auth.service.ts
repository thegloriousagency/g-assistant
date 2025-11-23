import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import type { User } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { EmailService } from '../email/email.service';

type SanitizedUser = Omit<User, 'password'>;

const PASSWORD_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly emailService: EmailService,
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
      tokenVersion: user.tokenVersion ?? 0,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }

  async requestPasswordReset(rawEmail: string) {
    const email = rawEmail.trim().toLowerCase();
    if (!email) return;
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return;
    }
    const { token } = await this.usersService.assignPasswordResetToken(user.id);
    try {
      await this.emailService.sendPasswordResetEmail(user.email, token);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Failed to send password reset email to ${user.email}: ${
          err?.message ?? 'unknown error'
        }`,
      );
    }
  }

  async resetPasswordWithToken(token: string, newPassword: string) {
    if (!PASSWORD_COMPLEXITY.test(newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.',
      );
    }

    const user = await this.usersService.findByResetToken(token);
    if (
      !user ||
      !user.passwordResetExpiresAt ||
      user.passwordResetExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired reset token.');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.usersService.updatePasswordAfterReset(user.id, hashedPassword);
    try {
      await this.emailService.sendPasswordChangedNotice(user.email);
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Failed to send password changed notice to ${user.email}: ${
          err?.message ?? 'unknown error'
        }`,
      );
    }
  }
}
