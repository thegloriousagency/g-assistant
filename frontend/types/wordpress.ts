export type WordpressEventCategory = {
  id: number;
  name: string;
  slug: string;
};

export type WordpressEventOccurrence = {
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
};

export type WordpressEventsResponse = {
  start: string;
  end: string;
  count: number;
  occurrences: WordpressEventOccurrence[];
};

export type WordpressConnectionTestResult = {
  ok: true;
  postsCount: number;
  events: {
    ok: boolean;
    count?: number;
    start: string;
    end: string;
    message?: string;
  };
};

export type WordpressMetaPrimitive = string | number | boolean | null;

export type WordpressEventUpsertPayload = {
  title: string;
  content?: string;
  status?: string;
  meta?: Record<
    string,
    | WordpressMetaPrimitive
    | undefined
    | WordpressMetaPrimitive[]
  >;
};

export type WordpressEventDetail = {
  id: number;
  status?: string;
  title?: {
    raw?: string;
    rendered?: string;
  };
  content?: {
    raw?: string;
    rendered?: string;
  };
  meta?: Record<string, unknown>;
};

export type WordpressLocation = {
  id: number;
  title: { rendered: string };
};

export type WordpressCecSettings = {
  default_location_mode: 'none' | 'text' | 'cpt';
  default_location_text: string;
  default_location_id: number;
  [key: string]: unknown;
};
