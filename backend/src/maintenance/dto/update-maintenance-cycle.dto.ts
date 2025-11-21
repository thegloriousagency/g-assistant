import { IsNumber, IsOptional } from 'class-validator';

export class UpdateMaintenanceCycleDto {
  @IsOptional()
  @IsNumber()
  baseHours?: number;

  @IsOptional()
  @IsNumber()
  carriedHours?: number;

  @IsOptional()
  @IsNumber()
  usedHours?: number;
}
