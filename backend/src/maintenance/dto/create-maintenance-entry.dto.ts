import {
  IsBoolean,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateMaintenanceEntryDto {
  @IsDateString()
  date!: string;

  @IsNumber()
  durationHours!: number;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsBoolean()
  isIncludedInPlan?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
