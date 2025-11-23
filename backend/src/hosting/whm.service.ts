import {
  BadGatewayException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface WhmSessionResponse {
  data?: {
    url?: string;
  };
  errors?: Array<{ code?: number; message?: string }>;
  status?: number;
}

interface WhmAccountSummaryResponse {
  data?: {
    acct?: Array<{
      plan?: string;
      disklimit?: string;
      diskused?: string;
      maxsql?: string;
      maxftp?: string;
      maxsub?: string;
      maxpop?: string;
      max_emailacct_quota?: string;
      maxbw?: string;
      bwlimit?: string;
    }>;
  };
  errors?: Array<{ code?: number; message?: string }>;
}

export interface HostingAccountSummary {
  planName: string | null;
  storageMb: number | null;
  diskUsedMb: number | null;
  databases: number | null;
  ftpUsers: number | null;
  bandwidthMb: number | null;
  subdomains: number | null;
  emailAccounts: number | null;
  emailQuotaMb: number | null;
}

@Injectable()
export class WhmService {
  private readonly logger = new Logger(WhmService.name);
  private readonly apiToken: string | undefined;
  private readonly resellerUser: string | undefined;
  private readonly host: string | undefined;

  constructor(private readonly configService: ConfigService) {
    this.apiToken = this.configService.get<string>('WHM_API_TOKEN');
    this.resellerUser = this.configService.get<string>(
      'WHM_RESELLER_USERNAME',
      'mlie6058',
    );
    this.host = this.configService.get<string>(
      'WHM_HOST',
      'https://cpanel.theglorious.agency:2087',
    );
  }

  private assertConfigured() {
    if (!this.apiToken || !this.resellerUser || !this.host) {
      throw new InternalServerErrorException('Hosting integration is not configured.');
    }
  }

  private getAuthHeaders() {
    return {
      Authorization: `whm ${this.resellerUser}:${this.apiToken}`,
    };
  }

  async createCpanelSession(username: string) {
    this.assertConfigured();

    const requestUrl = `${this.host}/json-api/create_user_session?api.version=1&user=${encodeURIComponent(
      username,
    )}&service=cpaneld`;

    try {
      const response = await axios.get<WhmSessionResponse>(requestUrl, {
        headers: this.getAuthHeaders(),
      });

      const sessionUrl = response.data?.data?.url;
      if (!sessionUrl) {
        const whmMessage = response.data?.errors?.[0]?.message;
        this.logger.warn(
          `WHM session missing url for user ${username}: ${whmMessage ?? 'Unknown error'}`,
        );
        throw new BadGatewayException(
          whmMessage ??
            'We could not create a hosting session right now. Please try again later.',
        );
      }

      return sessionUrl;
    } catch (error) {
      this.logger.error('Failed to create WHM session', error as Error);
      throw new BadGatewayException('Unable to contact the hosting server right now.');
    }
  }

  async fetchAccountSummary(username: string): Promise<HostingAccountSummary> {
    this.assertConfigured();

    const requestUrl = `${this.host}/json-api/accountsummary?api.version=1&user=${encodeURIComponent(
      username,
    )}`;

    try {
      const response = await axios.get<WhmAccountSummaryResponse>(requestUrl, {
        headers: this.getAuthHeaders(),
      });

      const account = response.data?.data?.acct?.[0];
      if (!account) {
        const whmMessage = response.data?.errors?.[0]?.message;
        this.logger.warn(
          `WHM account summary missing acct data for user ${username}: ${whmMessage ?? 'Unknown error'}`,
        );
        throw new BadGatewayException(
          whmMessage ??
            'We could not load your hosting details right now. Please try again later.',
        );
      }

      return {
        planName: this.normalizePlanName(account.plan),
        storageMb: this.parseCapacity(account.disklimit),
        diskUsedMb: this.parseCapacity(account.diskused),
        databases: this.parseCount(account.maxsql),
        ftpUsers: this.parseCount(account.maxftp),
        bandwidthMb: this.parseCapacity(account.maxbw ?? account.bwlimit),
        subdomains: this.parseCount(account.maxsub),
        emailAccounts: this.parseCount(account.maxpop),
        emailQuotaMb: this.parseCapacity(account.max_emailacct_quota),
      };
    } catch (error) {
      this.logger.error('Failed to fetch WHM account summary', error as Error);
      throw new BadGatewayException('Unable to contact the hosting server right now.');
    }
  }

  private parseCount(value?: string | number | null): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isNaN(value) ? null : value;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unlimited') {
      return null;
    }
    const numeric = Number.parseInt(trimmed, 10);
    return Number.isNaN(numeric) ? null : numeric;
  }

  private parseCapacity(value?: string | number | null): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isNaN(value) ? null : value;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.toLowerCase() === 'unlimited') {
      return null;
    }

    const unit = trimmed.slice(-1).toLowerCase();
    const numeric = Number.parseFloat(trimmed.replace(/[^\d.]/g, ''));
    if (Number.isNaN(numeric)) {
      return null;
    }

    switch (unit) {
      case 't':
        return numeric * 1024 * 1024;
      case 'g':
        return numeric * 1024;
      case 'k':
        return numeric / 1024;
      case 'm':
        return numeric;
      default:
        return numeric;
    }
  }

  private normalizePlanName(name?: string | null): string | null {
    if (!name) {
      return null;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }
    const prefix = this.resellerUser ? `${this.resellerUser}_` : null;
    if (prefix && trimmed.startsWith(prefix)) {
      return trimmed.slice(prefix.length).trim() || null;
    }
    return trimmed;
  }

  getCpanelPasswordResetUrl(): string | null {
    this.assertConfigured();
    if (!this.host) {
      return null;
    }

    try {
      const parsed = new URL(this.host);
      const protocol = parsed.protocol || 'https:';
      const hostname = parsed.hostname;
      const port = 2083;
      return `${protocol}//${hostname}:${port}/resetpass?start=1`;
    } catch {
      return null;
    }
  }
}
