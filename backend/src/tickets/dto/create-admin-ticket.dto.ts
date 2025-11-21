import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { TicketPriority, TicketType } from '@prisma/client';

export class CreateAdminTicketDto {
  @IsString()
  @IsNotEmpty()
  tenantId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsEnum(TicketType)
  type!: TicketType;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}
