export class DraftPosterEventDto {
  id!: string;
  title!: string;
  startDateTime!: string;
  endDateTime!: string | null;
  isAllDay!: boolean;
  location!: string | null;
  notes!: string | null;
  uncertainty!: string | null;
  description!: string | null;
  relatedEventTitle!: string | null;
  relatedEventDetails!: string | null;
}

