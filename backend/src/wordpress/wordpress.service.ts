import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantsService } from '../tenants/tenants.service';

export interface WordpressPost {
  id: number;
  title: string;
  slug: string;
  status: string;
  date: string;
  modified: string;
}

@Injectable()
export class WordpressService {
  constructor(private readonly tenantsService: TenantsService) {}

  async getPostsForTenant(tenantId: string): Promise<WordpressPost[]> {
    const tenant = await this.tenantsService.findById(tenantId);
    if (!tenant) {
      throw new BadRequestException('Tenant not found');
    }

    if (!tenant.wpSiteUrl || !tenant.wpApiUser || !tenant.wpAppPassword) {
      throw new BadRequestException('Tenant WordPress configuration is incomplete');
    }

    const endpoint = new URL('/wp-json/wp/v2/posts', tenant.wpSiteUrl);
    endpoint.searchParams.set('per_page', '10');
    endpoint.searchParams.set('_fields', 'id,title,slug,status,date,modified');

    const response = await fetch(endpoint.toString(), {
      headers: {
        Authorization: `Basic ${Buffer.from(`${tenant.wpApiUser}:${tenant.wpAppPassword}`).toString('base64')}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new BadRequestException(
        `WordPress API error: ${response.status} ${response.statusText} ${text}`.trim(),
      );
    }

    const data = (await response.json()) as Array<{
      id: number;
      title: { rendered: string };
      slug: string;
      status: string;
      date: string;
      modified: string;
    }>;

    return data.map((post) => ({
      id: post.id,
      title: post.title?.rendered ?? '',
      slug: post.slug,
      status: post.status,
      date: post.date,
      modified: post.modified,
    }));
  }

  async testConnectionForTenant(tenantId: string) {
    const posts = await this.getPostsForTenant(tenantId);
    return {
      ok: true as const,
      postsCount: posts.length,
    };
  }
}
