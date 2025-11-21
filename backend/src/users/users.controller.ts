import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CreateClientUserDto } from './dto/create-client-user.dto';

@Controller('admin/tenants')
@UseGuards(JwtAuthGuard, AdminGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':tenantId/users')
  createClientUser(
    @Param('tenantId') tenantId: string,
    @Body() body: CreateClientUserDto,
  ) {
    return this.usersService.createClientUser(tenantId, body);
  }

  @Delete(':tenantId/users/:userId')
  async deleteClientUser(
    @Param('tenantId') tenantId: string,
    @Param('userId') userId: string,
  ) {
    await this.usersService.deleteClientUser(tenantId, userId);
    return { ok: true };
  }
}
