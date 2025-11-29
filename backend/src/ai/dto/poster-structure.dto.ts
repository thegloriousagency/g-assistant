export type PosterContextDto = {
  parishName: string | null;
  overallTheme: string | null;
  overallDescription: string | null;
};

export type StructuredEventDto = {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string | null;
  isAllDay: boolean;
  location: string | null;
  rawText: string | null;
  notes: string | null;
  uncertainty: string | null;
};

export type EventRelationshipDto = {
  sourceEventId: string;
  targetEventId: string;
  type: 'sequential' | 'part_of_series' | 'alternative' | 'unrelated';
  description: string | null;
};

export type PosterStructureDto = {
  posterContext: PosterContextDto;
  events: StructuredEventDto[];
  relationships: EventRelationshipDto[];
};

