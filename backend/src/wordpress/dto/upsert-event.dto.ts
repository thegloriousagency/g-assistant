import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpsertWordpressEventDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  status?: string;

  @IsOptional()
  @IsObject()
  meta?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  church_event_category?: number[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  church_event_tag?: number[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  featured_media?: number;

  @IsOptional()
  @IsString()
  lang?: string;
}
