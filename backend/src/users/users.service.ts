import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';
import { CreateClientUserDto } from './dto/create-client-user.dto';
import { EmailService } from '../email/email.service';

const PASSWORD_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createClientUser(tenantId: string, data: CreateClientUserDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const user = await this.prisma.user.create({
      data: {
        tenantId,
        email: data.email.toLowerCase(),
        password: hashedPassword,
        role: 'client',
      },
      select: {
        id: true,
        email: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });
    const { token } = await this.assignPasswordResetToken(user.id);
    await this.safeSendEmail(
      () => this.emailService.sendWelcomeSetPasswordEmail(user.email, token),
      'welcome set password',
      user.email,
    );

    return user;
  }

  async deleteClientUser(tenantId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, tenantId: true },
    });

    if (!user || user.tenantId !== tenantId) {
      throw new BadRequestException('User does not belong to this tenant');
    }

    await this.prisma.user.delete({
      where: { id: userId },
    });
  }

  async assignPasswordResetToken(userId: string, expiresInMs = 60 * 60 * 1000) {
    const token = this.generateToken();
    const hashedToken = this.hashToken(token);
    const expiresAt = new Date(Date.now() + expiresInMs);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordResetToken: hashedToken,
        passwordResetExpiresAt: expiresAt,
      },
    });
    return { token, expiresAt };
  }

  async findByResetToken(token: string): Promise<User | null> {
    if (!token) return null;
    const hashed = this.hashToken(token);
    return this.prisma.user.findFirst({
      where: { passwordResetToken: hashed },
    });
  }

  async updatePasswordAfterReset(userId: string, hashedPassword: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        password: hashedPassword,
        passwordUpdatedAt: new Date(),
        passwordResetToken: null,
        passwordResetExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    });
  }

  async triggerPasswordResetEmail(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { token } = await this.assignPasswordResetToken(user.id);
    await this.safeSendEmail(
      () => this.emailService.sendPasswordResetEmail(user.email, token),
      'admin password reset',
      user.email,
    );
    return user;
  }

  async resendWelcomeEmail(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        tenantId: true,
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.tenantId) {
      throw new BadRequestException('User is not associated with a tenant.');
    }

    if (user.role?.toLowerCase() !== 'client') {
      throw new BadRequestException(
        'Welcome emails are only available for client users.',
      );
    }

    const { token } = await this.assignPasswordResetToken(user.id);
    await this.safeSendEmail(
      () => this.emailService.sendWelcomeSetPasswordEmail(user.email, token),
      'welcome set password (manual)',
      user.email,
    );
  }

  async changePasswordForUser(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      throw new BadRequestException('Current password is incorrect.');
    }

    if (!PASSWORD_COMPLEXITY.test(newPassword)) {
      throw new BadRequestException(
        'Password must be at least 8 characters and include uppercase, lowercase, number, and symbol.',
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await this.updatePasswordAfterReset(user.id, hashedPassword);
    await this.safeSendEmail(
      () => this.emailService.sendPasswordChangedNotice(user.email),
      'password changed notice',
      user.email,
    );
  }

  async initiateEmailChange(userId: string, password: string, newEmailRaw: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const newEmail = newEmailRaw.trim().toLowerCase();
    if (!newEmail) {
      throw new BadRequestException('Email is required.');
    }

    if (user.email === newEmail) {
      throw new BadRequestException('New email must be different.');
    }

    const existing = await this.prisma.user.findUnique({ where: { email: newEmail } });
    if (existing) {
      throw new BadRequestException('Email is already in use.');
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      throw new BadRequestException('Password is incorrect.');
    }

    const token = this.generateToken();
    const hashedToken = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        pendingEmail: newEmail,
        pendingEmailToken: hashedToken,
        pendingEmailExpiresAt: expiresAt,
      },
    });

    await this.safeSendEmail(
      () => this.emailService.sendPendingEmailVerification(newEmail, token),
      'pending email verification',
      newEmail,
    );
  }

  async confirmEmailChange(token: string) {
    if (!token) {
      throw new BadRequestException('Token is required.');
    }
    const hashed = this.hashToken(token);
    const user = await this.prisma.user.findFirst({
      where: { pendingEmailToken: hashed },
    });
    if (
      !user ||
      !user.pendingEmail ||
      !user.pendingEmailExpiresAt ||
      user.pendingEmailExpiresAt.getTime() < Date.now()
    ) {
      throw new BadRequestException('Invalid or expired token.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: user.pendingEmail,
        pendingEmail: null,
        pendingEmailToken: null,
        pendingEmailExpiresAt: null,
        tokenVersion: { increment: 1 },
      },
    });
  }

  private async safeSendEmail(
    fn: () => Promise<unknown>,
    context: string,
    email: string,
  ) {
    try {
      await fn();
    } catch (error) {
      const err = error as Error;
      this.logger.warn(
        `Failed to send ${context} email to ${email}: ${err?.message ?? 'unknown error'}`,
      );
    }
  }

  generateToken(bytes = 48) {
    return randomBytes(bytes).toString('hex');
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
