import {
  IsBoolean,
  IsEmail,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  IsUrl,
} from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  wpSiteUrl?: string;

  @IsOptional()
  @IsString()
  wpApiUser?: string;

  @IsOptional()
  @IsString()
  wpAppPassword?: string;

  @IsOptional()
  @IsISO8601()
  hostingExpirationDate?: string;

  @IsOptional()
  @IsISO8601()
  maintenanceExpirationDate?: string;

  @IsOptional()
  @IsBoolean()
  hostingOrdered?: boolean;

  @IsOptional()
  @IsBoolean()
  maintenanceOrdered?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  maintenancePlanName?: string;

  @IsOptional()
  @IsNumber()
  maintenanceHoursPerMonth?: number;

  @IsOptional()
  @IsString()
  maintenanceCarryoverMode?: string;

  @IsOptional()
  @IsISO8601()
  maintenanceStartDate?: string;
}
