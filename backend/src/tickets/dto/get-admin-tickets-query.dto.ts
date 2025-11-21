import { Transform } from 'class-transformer';
import { IsOptional, IsPositive } from 'class-validator';

export class GetAdminTicketsQueryDto {
  @IsOptional()
  @IsPositive()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  page?: number;

  @IsOptional()
  @IsPositive()
  @Transform(({ value }) => (value ? Number(value) : undefined))
  pageSize?: number;
}
