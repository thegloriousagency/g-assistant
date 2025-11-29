import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { TenantsService } from '../tenants/tenants.service';
import { WordpressEventsQueryDto } from './dto/fetch-events.dto';
import { UpsertWordpressEventDto } from './dto/upsert-event.dto';
import {
  WordpressCecSettings,
  WordpressConnectionTestResult,
  WordpressEventsResponse,
  WordpressLocation,
} from './wordpress.types';

export interface WordpressPost {
  id: number;
  title: string;
  slug: string;
  status: string;
  date: string;
  modified: string;
}

interface TenantWordpressConfig {
  id: string;
  wpSiteUrl: string;
  wpApiUser: string;
  wpAppPassword: string;
}

@Injectable()
export class WordpressService {
  private readonly logger = new Logger(WordpressService.name);

  constructor(private readonly tenantsService: TenantsService) {}

  async getPostsForTenant(tenantId: string): Promise<WordpressPost[]> {
    const config = await this.getTenantWordpressConfig(tenantId);
    const endpoint = new URL('/wp-json/wp/v2/posts', config.wpSiteUrl);
    endpoint.searchParams.set('per_page', '10');
    endpoint.searchParams.set('_fields', 'id,title,slug,status,date,modified');

    const data = await this.wordpressFetch<
      Array<{
      id: number;
      title: { rendered: string };
      slug: string;
      status: string;
      date: string;
      modified: string;
      }>
    >(config, endpoint);

    return data.map((post) => ({
      id: post.id,
      title: post.title?.rendered ?? '',
      slug: post.slug,
      status: post.status,
      date: post.date,
      modified: post.modified,
    }));
  }

  async getLocationsForTenant(tenantId: string): Promise<WordpressLocation[]> {
    const config = await this.getTenantWordpressConfig(tenantId);
    const endpoint = new URL('/wp-json/wp/v2/church_location', config.wpSiteUrl);
    endpoint.searchParams.set('per_page', '100');
    endpoint.searchParams.set('_fields', 'id,title');
    return this.wordpressFetch<WordpressLocation[]>(config, endpoint);
  }

  async getSettingsForTenant(tenantId: string): Promise<WordpressCecSettings> {
    const config = await this.getTenantWordpressConfig(tenantId);
    const endpoint = new URL('/wp-json/wp/v2/settings', config.wpSiteUrl);
    const settings = await this.wordpressFetch<{ cec_settings: WordpressCecSettings }>(
      config,
      endpoint,
    );
    return settings.cec_settings;
  }

  async getEventsForTenant(
    tenantId: string,
    params: WordpressEventsQueryDto,
  ): Promise<WordpressEventsResponse> {
    const config = await this.getTenantWordpressConfig(tenantId);
    const endpoint = new URL('/wp-json/church-events/v1/events', config.wpSiteUrl);
    endpoint.searchParams.set('start', params.start);
    endpoint.searchParams.set('end', params.end);
    if (params.category) {
      endpoint.searchParams.set('category', params.category);
    }
    if (params.tag) {
      endpoint.searchParams.set('tag', params.tag);
    }
    if (params.limit) {
      endpoint.searchParams.set('limit', String(params.limit));
    }
    if (params.lang) {
      endpoint.searchParams.set('lang', params.lang);
    }

    return this.wordpressFetch<WordpressEventsResponse>(config, endpoint);
  }

  async getEventDetailsForTenant(tenantId: string, eventId: number) {
    if (!Number.isInteger(eventId) || eventId <= 0) {
      throw new BadRequestException('Invalid WordPress event ID');
    }
    const config = await this.getTenantWordpressConfig(tenantId);
    const endpoint = new URL(`/wp-json/wp/v2/church_event/${eventId}`, config.wpSiteUrl);
    endpoint.searchParams.set('context', 'edit');
    endpoint.searchParams.set('_fields', 'id,title,content,meta,status');
    return this.wordpressFetch<Record<string, unknown>>(config, endpoint);
  }

  async createEventForTenant(
    tenantId: string,
    payload: UpsertWordpressEventDto,
  ): Promise<Record<string, unknown>> {
    const config = await this.getTenantWordpressConfig(tenantId);
    const endpoint = new URL('/wp-json/wp/v2/church_event', config.wpSiteUrl);
    const body = this.buildEventPayload(payload, endpoint);
    this.logEventPayload('create', tenantId, payload);
    const result = await this.wordpressFetch<Record<string, unknown>>(config, endpoint, {
      method: 'POST',
      body,
    });
    await this.logEventResponse('create', tenantId, result, config);
    return result;
  }

  async updateEventForTenant(
    tenantId: string,
    eventId: number,
    payload: UpsertWordpressEventDto,
  ): Promise<Record<string, unknown>> {
    if (!Number.isInteger(eventId) || eventId <= 0) {
      throw new BadRequestException('Invalid WordPress event ID');
    }
    const config = await this.getTenantWordpressConfig(tenantId);
    const endpoint = new URL(`/wp-json/wp/v2/church_event/${eventId}`, config.wpSiteUrl);
    const body = this.buildEventPayload(payload, endpoint);
    this.logEventPayload('update', tenantId, payload);
    const result = await this.wordpressFetch<Record<string, unknown>>(config, endpoint, {
      method: 'POST',
      body,
    });
    await this.logEventResponse('update', tenantId, result, config, eventId);
    return result;
  }

  async deleteEventForTenant(tenantId: string, eventId: number) {
    if (!Number.isInteger(eventId) || eventId <= 0) {
      throw new BadRequestException('Invalid WordPress event ID');
    }
    const config = await this.getTenantWordpressConfig(tenantId);
    const endpoint = new URL(`/wp-json/wp/v2/church_event/${eventId}`, config.wpSiteUrl);
    await this.wordpressFetch(config, endpoint, { method: 'DELETE' });
    return { ok: true as const };
  }

  async testConnectionForTenant(
    tenantId: string,
  ): Promise<WordpressConnectionTestResult> {
    const posts = await this.getPostsForTenant(tenantId);
    const start = this.formatDateOnly(new Date());
    const end = this.formatDateOnly(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000));
    try {
      const events = await this.getEventsForTenant(tenantId, {
        start,
        end,
        limit: 5,
      });
      return {
        ok: true,
        postsCount: posts.length,
        events: {
          ok: true,
          count: events.count,
          start,
          end,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown events error';
      this.logger.warn(
        `WordPress events test failed for tenant ${tenantId}: ${message}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        ok: true,
        postsCount: posts.length,
        events: {
          ok: false,
          start,
          end,
          message,
        },
      };
    }
  }

  private async getTenantWordpressConfig(
    tenantId: string,
  ): Promise<TenantWordpressConfig> {
    const tenant = await this.tenantsService.findById(tenantId);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }
    if (!tenant.wpSiteUrl || !tenant.wpApiUser || !tenant.wpAppPassword) {
      throw new BadRequestException('Tenant WordPress configuration is incomplete');
    }
    return {
      id: tenant.id,
      wpSiteUrl: tenant.wpSiteUrl,
      wpApiUser: tenant.wpApiUser,
      wpAppPassword: tenant.wpAppPassword,
    };
  }

  private buildEventPayload(payload: UpsertWordpressEventDto, endpoint: URL) {
    const { lang, ...rest } = payload;
    if (lang) {
      endpoint.searchParams.set('lang', lang);
    }
    return JSON.stringify(rest);
  }

  private async wordpressFetch<T>(
    config: TenantWordpressConfig,
    pathOrUrl: string | URL,
    init: RequestInit = {},
  ): Promise<T> {
    const url =
      pathOrUrl instanceof URL ? pathOrUrl : new URL(pathOrUrl, config.wpSiteUrl);
    const method = init.method ?? 'GET';
    this.logger.debug(`[WordPress] ${method} ${url.pathname} (tenant=${config.id})`);

    const headers = {
      'Content-Type': 'application/json',
      ...this.normalizeHeaders(init.headers),
      Authorization: `Basic ${this.encodeCredentials(config)}`,
    };

    const response = await fetch(url.toString(), {
      ...init,
      headers,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new BadRequestException(
        `WordPress API error: ${response.status} ${response.statusText} ${text}`.trim(),
      );
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return (await response.json()) as T;
  }

  private normalizeHeaders(headers?: HeadersInit): Record<string, string> {
    if (!headers) {
      return {};
    }
    if (headers instanceof Headers) {
      const result: Record<string, string> = {};
      headers.forEach((value, key) => {
        result[key] = value;
      });
      return result;
    }
    if (Array.isArray(headers)) {
      return headers.reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {});
    }
    return { ...headers };
  }

  private encodeCredentials(config: TenantWordpressConfig) {
    return Buffer.from(`${config.wpApiUser}:${config.wpAppPassword}`).toString('base64');
  }

  private formatDateOnly(date: Date) {
    return date.toISOString().split('T')[0];
  }

  private logEventPayload(
    action: 'create' | 'update',
    tenantId: string,
    payload: UpsertWordpressEventDto,
  ) {
    const safePayload = {
      title: payload.title,
      status: payload.status ?? 'publish',
      meta: this.summarizeMeta(payload.meta),
    };
    this.logger.debug(
      `[WordPress][${action}] tenant=${tenantId} payload=${JSON.stringify(safePayload)}`,
    );
  }

  private async logEventResponse(
    action: 'create' | 'update',
    tenantId: string,
    response: Record<string, unknown>,
    config: TenantWordpressConfig,
    fallbackEventId?: number,
  ) {
    const meta = this.extractMeta(response);
    if (meta) {
      this.logger.debug(
        `[WordPress][${action}] tenant=${tenantId} responseMeta=${JSON.stringify(this.summarizeMeta(meta))}`,
      );
      return;
    }

    const eventId = fallbackEventId ?? this.extractNumericId(response);

    if (typeof eventId === 'number' && Number.isFinite(eventId)) {
      await this.logRemoteMetaSnapshot(action, tenantId, config, eventId);
      return;
    }

    this.logger.debug(
      `[WordPress][${action}] tenant=${tenantId} response received without meta`,
    );
  }

  private extractMeta(response: Record<string, unknown>) {
    const metaCandidate = response.meta;
    if (!metaCandidate || typeof metaCandidate !== 'object') {
      return undefined;
    }
    return metaCandidate as Record<string, unknown>;
  }

  private summarizeMeta(meta?: Record<string, unknown>) {
    if (!meta) {
      return undefined;
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(meta)) {
      if (Array.isArray(value)) {
        result[key] = value.map((entry) => this.truncateValue(entry));
      } else {
        result[key] = this.truncateValue(value);
      }
    }
    return result;
  }

  private truncateValue(value: unknown) {
    if (typeof value !== 'string') {
      return value;
    }
    if (value.length <= 200) {
      return value;
    }
    return `${value.slice(0, 200)}…`;
  }

  private extractNumericId(payload: Record<string, unknown>) {
    const rawId = payload.id;
    if (typeof rawId === 'number' && Number.isFinite(rawId)) {
      return rawId;
    }
    if (typeof rawId === 'string') {
      const parsed = Number(rawId);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }

  private async logRemoteMetaSnapshot(
    action: 'create' | 'update',
    tenantId: string,
    config: TenantWordpressConfig,
    eventId: number,
  ) {
    try {
      const endpoint = new URL(
        `/wp-json/wp/v2/church_event/${eventId}`,
        config.wpSiteUrl,
      );
      endpoint.searchParams.set('context', 'edit');
      endpoint.searchParams.set('_fields', 'id,meta');
      const detail = await this.wordpressFetch<Record<string, unknown>>(config, endpoint);
      const meta = this.extractMeta(detail);
      if (meta) {
        this.logger.debug(
          `[WordPress][${action}] tenant=${tenantId} meta snapshot=${JSON.stringify(
            this.summarizeMeta(meta),
          )}`,
        );
      } else {
        this.logger.debug(
          `[WordPress][${action}] tenant=${tenantId} meta snapshot missing after fetch`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `[WordPress][${action}] tenant=${tenantId} failed to fetch meta snapshot for event ${eventId}: ${message}`,
      );
    }
  }
}
