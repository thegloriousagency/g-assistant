import { IsArray, IsString } from 'class-validator';

export class SetTenantFeaturesDto {
  @IsArray()
  @IsString({ each: true })
  featureIds!: string[];
}
