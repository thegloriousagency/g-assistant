import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateMaintenanceTaskDto {
  @IsString()
  @MaxLength(255)
  title!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
