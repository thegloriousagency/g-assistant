import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMaintenanceFeatureDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  label!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
