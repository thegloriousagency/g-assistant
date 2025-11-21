import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { TicketType } from '@prisma/client';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsEnum(TicketType)
  type!: TicketType;
}
