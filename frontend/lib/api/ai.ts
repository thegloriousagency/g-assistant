import { apiFetch } from "@/lib/api-client";

export type DraftPosterEvent = {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string | null;
  isAllDay: boolean;
  location: string | null;
  notes: string | null;
  uncertainty: string | null;
  description: string | null;
  relatedEventTitle: string | null;
  relatedEventDetails: string | null;
};

export type ImportPosterResponse = {
  ok: boolean;
  events: DraftPosterEvent[];
};

export async function uploadPosterImage(
  file: File,
): Promise<ImportPosterResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return apiFetch<ImportPosterResponse>(
    "/ai/events-from-image",
    {
      method: "POST",
      body: formData,
    },
    true,
  );
}

