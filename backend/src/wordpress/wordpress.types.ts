export interface WordpressEventCategory {
  id: number;
  name: string;
  slug: string;
}

export interface WordpressEventOccurrence {
  event_id: number;
  title: string;
  permalink: string;
  start: string;
  end: string;
  all_day: boolean;
  location?: string;
  location_mode?: string;
  location_id?: number;
  categories?: WordpressEventCategory[];
  tags?: WordpressEventCategory[];
}

export interface WordpressEventsResponse {
  start: string;
  end: string;
  count: number;
  occurrences: WordpressEventOccurrence[];
}

export interface WordpressConnectionTestResult {
  ok: true;
  postsCount: number;
  events: {
    ok: boolean;
    count?: number;
    start: string;
    end: string;
    message?: string;
  };
}

export interface WordpressLocation {
  id: number;
  title: { rendered: string };
}

export interface WordpressCecSettings {
  default_location_mode: 'none' | 'text' | 'cpt';
  default_location_text: string;
  default_location_id: number;
  [key: string]: unknown;
}
