import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { AiService } from './ai.service';
import { DraftPosterEventDto } from './dto/draft-poster-event.dto';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('events-from-image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
    }),
  )
  async eventsFromImage(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ ok: true; events: DraftPosterEventDto[] }> {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const parishTimezone =
      process.env.PARISH_TIMEZONE || 'America/Edmonton';
    const events = await this.aiService.extractEventsFromPoster(file, {
      parishTimezone,
      currentDate: new Date(),
    });

    return { ok: true, events };
  }
}

