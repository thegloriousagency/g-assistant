import { BadRequestException, Inject, Injectable, Logger, Optional } from '@nestjs/common';
import OpenAI from 'openai';
import type { Response as OpenAIResponse } from 'openai/resources/responses/responses';
import { DraftPosterEventDto } from './dto/draft-poster-event.dto';
import { EventRelationshipDto, PosterStructureDto } from './dto/poster-structure.dto';

type ExtractOptions = {
  parishTimezone: string;
  currentDate: Date;
};

const STRUCTURE_SCHEMA = {
  type: 'object',
  required: ['posterContext', 'events', 'relationships'],
  additionalProperties: false,
  properties: {
    posterContext: {
      type: 'object',
      required: ['parishName', 'overallTheme', 'overallDescription'],
      additionalProperties: false,
      properties: {
        parishName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        overallTheme: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        overallDescription: { anyOf: [{ type: 'string' }, { type: 'null' }] },
      },
    },
    events: {
      type: 'array',
      items: {
        type: 'object',
        required: [
          'id',
          'title',
          'startDateTime',
          'endDateTime',
          'isAllDay',
          'location',
          'rawText',
          'notes',
          'uncertainty',
        ],
        additionalProperties: false,
        properties: {
          id: { type: 'string', description: 'Unique id such as "event1"' },
          title: { type: 'string' },
          startDateTime: {
            type: 'string',
            format: 'date-time',
          },
          endDateTime: {
            anyOf: [
              { type: 'string', format: 'date-time' },
              { type: 'null' },
            ],
          },
          isAllDay: { type: 'boolean' },
          location: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          rawText: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          notes: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          uncertainty: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
    },
    relationships: {
      type: 'array',
      items: {
        type: 'object',
        required: ['sourceEventId', 'targetEventId', 'type', 'description'],
        additionalProperties: false,
        properties: {
          sourceEventId: { type: 'string' },
          targetEventId: { type: 'string' },
          type: {
            type: 'string',
            enum: ['sequential', 'part_of_series', 'alternative', 'unrelated'],
          },
          description: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
    },
  },
} as const;

const DESCRIPTION_SCHEMA = {
  type: 'object',
  required: ['events'],
  additionalProperties: false,
  properties: {
    events: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'description'],
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  },
} as const;

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly openai: OpenAI;
  private readonly visionModel = 'gpt-4.1-mini';
  private readonly textModel: string;

  constructor(
    @Optional() @Inject('OPENAI_CLIENT') openaiClient?: OpenAI | null,
    @Optional() @Inject('OPENAI_TEXT_MODEL') textModel?: string | null,
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey && !openaiClient) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    this.openai = openaiClient ?? new OpenAI({ apiKey: apiKey as string });
    this.textModel = textModel ?? process.env.OPENAI_TEXT_MODEL ?? 'gpt-4.1-mini';
  }

  /**
   * Two-pass pipeline:
   * 1. Vision model extracts structured event data + relationships.
   * 2. Text-only model generates human-friendly descriptions from that structure.
   */
  async extractEventsFromPoster(
    file: Express.Multer.File,
    options: ExtractOptions,
  ): Promise<DraftPosterEventDto[]> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Empty file buffer');
    }

    const structure = await this.extractStructureFromPoster(file, options);
    if (!structure.events?.length) {
      this.logger.warn('Poster parsed but no events were detected.');
      return [];
    }

    const descriptions = await this.generateDescriptionsFromStructure(structure);
    const descriptionMap = new Map(descriptions.map((d) => [d.id, d.description]));
    const relationshipMap = this.buildRelationshipLookup(structure);

    return structure.events.map<DraftPosterEventDto>((event) => ({
      id: event.id,
      title: event.title,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      isAllDay: event.isAllDay,
      location: event.location,
      notes: event.notes,
      description: descriptionMap.get(event.id) ?? null,
      relatedEventTitle: relationshipMap.get(event.id)?.title ?? null,
      relatedEventDetails: relationshipMap.get(event.id)?.details ?? null,
      uncertainty: event.uncertainty,
    }));
  }

  private async extractStructureFromPoster(
    file: Express.Multer.File,
    options: ExtractOptions,
  ): Promise<PosterStructureDto> {
    const base64 = file.buffer.toString('base64');
    const prompt = this.buildStructurePrompt(options);

    try {
      const response = await this.openai.responses.create({
        model: this.visionModel,
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: prompt },
              { type: 'input_image', detail: 'auto', image_url: `data:image/jpeg;base64,${base64}` } as const,
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'poster_structure',
            strict: true,
            schema: STRUCTURE_SCHEMA,
          },
        },
      });

      const outputText = this.extractResponseText(response);
      if (!outputText) {
        throw new BadRequestException('AI returned no structured data');
      }

      const parsed = JSON.parse(outputText) as PosterStructureDto;
      parsed.events ??= [];
      parsed.relationships ??= [];
      return parsed;
    } catch (error) {
      this.logger.error('OpenAI structure extraction failed', error instanceof Error ? error.stack : undefined);
      throw new BadRequestException('AI parsing failed');
    }
  }

  private async generateDescriptionsFromStructure(structure: PosterStructureDto) {
    if (!structure.events.length) {
      return [];
    }

    const prompt = this.buildDescriptionPrompt(structure);

    const response = await this.openai.responses.create({
      model: this.textModel,
      input: [
        {
          role: 'user',
          content: [{ type: 'input_text', text: prompt }],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'poster_event_descriptions',
          strict: true,
          schema: DESCRIPTION_SCHEMA,
        },
      },
    });

    const outputText = this.extractResponseText(response);
    if (!outputText) {
      this.logger.warn('Description model returned no output.');
      return [];
    }

    const parsed = JSON.parse(outputText) as { events?: { id: string; description: string }[] };
    return parsed.events ?? [];
  }

  private buildStructurePrompt(options: ExtractOptions) {
    return `
Extract all scheduled church/parish events from this poster image as structured data.

Current date (for year inference): ${options.currentDate.toISOString()}.
Parish timezone: ${options.parishTimezone}.

Goals:
- Understand the entire poster: parish, overarching theme, and every individual event.
- Output a separate JSON object for each event. Each event must be self-contained and must not mix details from other events.

Rules:
- Only return real scheduled events (ignore generic announcements).
- Use ISO 8601 datetime strings in the parish timezone.
- If the year is missing, pick the closest future date relative to the current date.
- If the end time is missing, assume 1 hour duration unless it is clearly an all-day event.
- If the poster suggests a recurring pattern, describe it factually in "notes" but still return only the next occurrence.
- The "rawText" field should contain the textual snippet from the poster relevant to that event when possible.
- If events are related (parts of a series, sequential, alternatives), keep them as separate events and describe relationships in the "relationships" array using the provided enums.
- Do NOT write friendly or marketing copy here—only structured facts.
- If something is ambiguous, explain it in "uncertainty".
`.trim();
  }

  private buildDescriptionPrompt(structure: PosterStructureDto) {
    const structureJson = JSON.stringify(structure);
    return `
You are writing short, welcoming blurbs for a parish newsletter.

Input JSON:
${structureJson}

Instructions:
- For each event id, write a warm, inviting paragraph (max 4 sentences) focusing on that specific event's what/when/where and why someone should attend.
- Use the event's title, start/end times, location, raw text, and notes.
- You may briefly mention directly related events at the end (e.g. "You can also stay for the parish dinner afterwards"), but keep the main focus on the current event.
- Do not invent new dates or events. Only use information available in the JSON.
- Return JSON matching the schema: [{ id, description }].
`.trim();
  }

  private buildRelationshipLookup(structure: PosterStructureDto) {
    const titleById = new Map(structure.events.map((event) => [event.id, event.title]));
    const relationships = new Map<
      string,
      {
        title: string;
        details: string;
      }
    >();

    for (const relationship of structure.relationships ?? []) {
      if (relationship.type === 'unrelated') continue;
      if (relationships.has(relationship.sourceEventId)) continue;

      const targetTitle = titleById.get(relationship.targetEventId);
      if (!targetTitle) continue;

      const details =
        relationship.description ??
        this.fallbackRelationshipText(relationship.type as EventRelationshipDto['type'], targetTitle);

      relationships.set(relationship.sourceEventId, {
        title: targetTitle,
        details,
      });
    }

    return relationships;
  }

  private fallbackRelationshipText(type: EventRelationshipDto['type'], targetTitle: string) {
    switch (type) {
      case 'sequential':
        return `Follows ${targetTitle}.`;
      case 'part_of_series':
        return `Part of the same series as ${targetTitle}.`;
      case 'alternative':
        return `Alternative option to ${targetTitle}.`;
      default:
        return `Related to ${targetTitle}.`;
    }
  }

  private extractResponseText(response: OpenAIResponse) {
    if (response.output_text && response.output_text.length > 0) {
      return response.output_text;
    }
    return null;
  }
}

