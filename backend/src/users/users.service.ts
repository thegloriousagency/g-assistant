import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CreateClientUserDto } from './dto/create-client-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async createClientUser(tenantId: string, data: CreateClientUserDto) {
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
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
}
