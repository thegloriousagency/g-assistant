import { Injectable, Logger } from '@nestjs/common';
import { BetaAnalyticsDataClient } from '@google-analytics/data';
import type { protos } from '@google-analytics/data';
import { PrismaService } from '../prisma/prisma.service';

type AnalyticsClient = InstanceType<typeof BetaAnalyticsDataClient>;

type RunReportParams = {
  property: string;
  dateRanges: { startDate: string; endDate: string }[];
  metrics: { name: string }[];
  dimensions?: { name: string }[];
  orderBys?: protos.google.analytics.data.v1beta.IOrderBy[];
  limit?: number;
};

export type Ga4Range = 'last_7_days' | 'last_30_days' | 'last_90_days';

type Ga4Totals = {
  users: number;
  sessions: number;
  pageViews: number;
  avgSessionDuration: number;
};

type Ga4TimeseriesRow = {
  date: string;
  sessions: number;
  users: number;
};

type Ga4TopPage = {
  path: string;
  title: string | null;
  views: number;
};

type Ga4TopChannel = {
  channel: string;
  sessions: number;
};

export type Ga4Summary = {
  range: Ga4Range;
  configured: boolean;
  error: string | null;
  totals: Ga4Totals;
  timeseries: Ga4TimeseriesRow[];
  topPages: Ga4TopPage[];
  topChannels: Ga4TopChannel[];
};

const CACHE_TTL_MS = 10 * 60 * 1000;

type PingResult =
  | {
      ok: true;
      users?: number;
      sessions?: number;
    }
  | {
      ok: false;
      error: string;
    };

@Injectable()
export class Ga4Service {
  private client: AnalyticsClient | null = null;
  private readonly logger = new Logger(Ga4Service.name);
  private readonly summaryCache = new Map<
    string,
    { fetchedAt: number; data: Ga4Summary }
  >();

  constructor(private readonly prisma: PrismaService) {}

  private getClient(): AnalyticsClient | null {
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    this.logger.debug(
      `[GA4] GOOGLE_APPLICATION_CREDENTIALS=${credentialsPath ?? 'undefined'}`,
    );
    if (!credentialsPath) {
      this.logger.warn('[GA4] No credentials path configured.');
      return null;
    }
    if (!this.client) {
      this.logger.debug('[GA4] Creating BetaAnalyticsDataClient instance.');
      this.client = new BetaAnalyticsDataClient();
    }
    return this.client;
  }

  private normalizeRange(range?: string): Ga4Range {
    if (range === 'last_7_days' || range === 'last_30_days' || range === 'last_90_days') {
      return range;
    }
    return 'last_30_days';
  }

  private getDateRange(range: Ga4Range) {
    const map: Record<Ga4Range, number> = {
      last_7_days: 7,
      last_30_days: 30,
      last_90_days: 90,
    };
    const days = map[range];
    return { startDate: `${days}daysAgo`, endDate: 'today' };
  }

  private buildEmptySummary(
    range: Ga4Range,
    configured: boolean,
    error: string | null,
  ): Ga4Summary {
    return {
      range,
      configured,
      error,
      totals: {
        users: 0,
        sessions: 0,
        pageViews: 0,
        avgSessionDuration: 0,
      },
      timeseries: [],
      topPages: [],
      topChannels: [],
    };
  }

  private async runReport(
    client: AnalyticsClient,
    params: RunReportParams,
  ): Promise<protos.google.analytics.data.v1beta.IRunReportResponse> {
    const [response] = await client.runReport({
      property: params.property,
      dateRanges: params.dateRanges,
      metrics: params.metrics,
      dimensions: params.dimensions,
      orderBys: params.orderBys,
      limit: params.limit,
    });
    return response;
  }

  async pingProperty(propertyId: string): Promise<PingResult> {
    this.logger.debug(`[GA4] pingProperty called with propertyId=${propertyId}`);
    const client = this.getClient();
    if (!client) {
      this.logger.warn('[GA4] Client unavailable, integration not configured.');
      return { ok: false, error: 'GA4 integration is not configured.' };
    }

    try {
      const response = await this.runReport(client, {
        property: propertyId,
        dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
        metrics: [{ name: 'totalUsers' }, { name: 'sessions' }],
      });

      const totalUsers = response.rows?.[0]?.metricValues?.[0]?.value;
      const sessions = response.rows?.[0]?.metricValues?.[1]?.value;

      const result: PingResult = {
        ok: true,
        users: totalUsers ? Number(totalUsers) : undefined,
        sessions: sessions ? Number(sessions) : undefined,
      };
      this.logger.debug(
        `[GA4] pingProperty success users=${result.users} sessions=${result.sessions}`,
      );
      return result;
    } catch (error) {
      const message = this.normalizeError(error);
      this.logger.warn(`[GA4] pingProperty error=${message}`);
      return { ok: false, error: message };
    }
  }

  async getSummaryForTenant(
    tenantId: string,
    propertyId: string | null,
    rangeInput?: string,
  ): Promise<Ga4Summary> {
    const range = this.normalizeRange(rangeInput);

    if (!propertyId) {
      return this.buildEmptySummary(
        range,
        false,
        'Analytics is not connected for this account.',
      );
    }

    const cacheKey = `${tenantId}:${range}`;
    const cached = this.summaryCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.data;
    }

    const client = this.getClient();
    if (!client) {
      return this.buildEmptySummary(range, false, 'GA4 integration is not configured.');
    }

    try {
      const summary = await this.buildSummary(client, propertyId, range);
      this.summaryCache.set(cacheKey, { fetchedAt: Date.now(), data: summary });
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { ga4ConnectedAt: new Date(), ga4LastSyncStatus: 'ok' },
      });
      return summary;
    } catch (error) {
      const message = this.normalizeError(error);
      const status = this.mapStatusFromMessage(message);
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { ga4LastSyncStatus: status },
      });
      return this.buildEmptySummary(range, true, message);
    }
  }

  private async buildSummary(
    client: AnalyticsClient,
    propertyId: string,
    range: Ga4Range,
  ): Promise<Ga4Summary> {
    const dateRange = this.getDateRange(range);

    const totalsResponse = await this.runReport(client, {
      property: propertyId,
      dateRanges: [dateRange],
      metrics: [
        { name: 'totalUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'averageSessionDuration' },
      ],
    });

    const timeseriesResponse = await this.runReport(client, {
      property: propertyId,
      dateRanges: [dateRange],
      metrics: [{ name: 'sessions' }, { name: 'totalUsers' }],
      dimensions: [{ name: 'date' }],
      orderBys: [
        {
          dimension: { dimensionName: 'date' },
        },
      ],
    });

    const topPagesResponse = await this.runReport(client, {
      property: propertyId,
      dateRanges: [dateRange],
      metrics: [{ name: 'screenPageViews' }],
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      orderBys: [
        {
          metric: { metricName: 'screenPageViews' },
          desc: true,
        },
      ],
      limit: 10,
    });

    const topChannelsResponse = await this.runReport(client, {
      property: propertyId,
      dateRanges: [dateRange],
      metrics: [{ name: 'sessions' }],
      dimensions: [{ name: 'sessionDefaultChannelGroup' }],
      orderBys: [
        {
          metric: { metricName: 'sessions' },
          desc: true,
        },
      ],
      limit: 10,
    });

    const totalsRow = totalsResponse.rows?.[0]?.metricValues ?? [];
    const totals: Ga4Totals = {
      users: Number(totalsRow[0]?.value ?? 0),
      sessions: Number(totalsRow[1]?.value ?? 0),
      pageViews: Number(totalsRow[2]?.value ?? 0),
      avgSessionDuration: Number(totalsRow[3]?.value ?? 0),
    };

    const timeseries: Ga4TimeseriesRow[] =
      timeseriesResponse.rows?.map((row) => {
        const dateValue = row.dimensionValues?.[0]?.value ?? '';
        const formattedDate =
          dateValue.length === 8
            ? `${dateValue.slice(0, 4)}-${dateValue.slice(4, 6)}-${dateValue.slice(6, 8)}`
            : dateValue;
        return {
          date: formattedDate,
          sessions: Number(row.metricValues?.[0]?.value ?? 0),
          users: Number(row.metricValues?.[1]?.value ?? 0),
        };
      }) ?? [];

    const topPages: Ga4TopPage[] =
      topPagesResponse.rows?.map((row) => ({
        path: row.dimensionValues?.[0]?.value ?? '(not set)',
        title: row.dimensionValues?.[1]?.value ?? null,
        views: Number(row.metricValues?.[0]?.value ?? 0),
      })) ?? [];

    const topChannels: Ga4TopChannel[] =
      topChannelsResponse.rows?.map((row) => ({
        channel: row.dimensionValues?.[0]?.value ?? '(not set)',
        sessions: Number(row.metricValues?.[0]?.value ?? 0),
      })) ?? [];

    return {
      range,
      configured: true,
      error: null,
      totals,
      timeseries,
      topPages,
      topChannels,
    };
  }

  private normalizeError(error: unknown): string {
    const message =
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message?: string }).message)
        : '';
    if (message.includes('PERMISSION_DENIED')) {
      return 'Permission denied for this GA4 property.';
    }
    if (
      message.includes('NOT_FOUND') ||
      message.includes('requested entity was not found')
    ) {
      return 'GA4 property not found.';
    }
    this.logger.error('Unexpected GA4 error', error as Error);
    return 'Unexpected error contacting Google Analytics.';
  }

  private mapStatusFromMessage(message: string) {
    if (message.includes('Permission denied')) return 'error: permission_denied';
    if (message.includes('not configured')) return 'error: not_configured';
    if (message.includes('not found')) return 'error: property_not_found';
    return 'error: unknown';
  }
}
