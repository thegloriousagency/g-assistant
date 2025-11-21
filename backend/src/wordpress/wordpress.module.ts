import { Module } from '@nestjs/common';
import { WordpressService } from './wordpress.service';
import { WordpressController } from './wordpress.controller';
import { TenantsModule } from '../tenants/tenants.module';

@Module({
  imports: [TenantsModule],
  providers: [WordpressService],
  controllers: [WordpressController],
})
export class WordpressModule {}
