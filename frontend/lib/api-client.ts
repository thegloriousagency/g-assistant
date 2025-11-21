import { getToken } from './auth-storage';

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getApiBase() {
  const fallback = 'http://localhost:3001';
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.warn(
        '[apiFetch] NEXT_PUBLIC_API_URL missing, defaulting to',
        fallback,
      );
    }
    return fallback;
  }
  return base.replace(/\/$/, '');
}

interface ApiFetchOptions extends RequestInit {
  includeAuthToken?: boolean;
}

const isDev = process.env.NODE_ENV !== 'production';

export async function apiFetch<TResponse>(
  path: string,
  options: ApiFetchOptions = {},
  includeAuthToken = false,
): Promise<TResponse> {
  const baseUrl = getApiBase();
  const headers = new Headers(options.headers ?? {});

  if (
    options.body &&
    !(options.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  if (includeAuthToken || options.includeAuthToken) {
    const token = getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  if (isDev) {
    // eslint-disable-next-line no-console
    console.debug('[apiFetch] request', {
      path,
      url: `${baseUrl}${path}`,
      includeAuthToken: includeAuthToken || options.includeAuthToken,
      method: options.method ?? 'GET',
    });
  }

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('Content-Type') ?? '';
  const isJson = contentType.includes('application/json');
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      (payload && typeof payload === 'object' && 'message' in payload
        ? String((payload as { message?: string }).message)
        : response.statusText) || 'Request failed';
    if (isDev) {
      // eslint-disable-next-line no-console
      console.error('[apiFetch] error', {
        path,
        status: response.status,
        message,
        payload,
      });
    }
    throw new ApiError(message, response.status, payload);
  }

  return (payload as TResponse) ?? (undefined as TResponse);
}
