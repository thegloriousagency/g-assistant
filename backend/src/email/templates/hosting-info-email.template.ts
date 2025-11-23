interface HostingInfoEmailContent {
  tenantName: string;
  siteUrl?: string | null;
  planName: string | null;
  storageMb: number | null;
  bandwidthMb: number | null;
  databases: number | null;
  ftpUsers: number | null;
  subdomains: number | null;
  emailAccounts: number | null;
  emailQuotaMb: number | null;
  hostingExpirationDate?: Date | null;
  cpanelLoginUrl: string;
  passwordResetUrl?: string | null;
}

const NUMBER_FORMAT = new Intl.NumberFormat('en-US');

function formatDate(date?: Date | null) {
  if (!date) {
    return 'Not yet set';
  }
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatCapacityMb(value?: number | null) {
  if (value === null || value === undefined) {
    return 'Unlimited';
  }
  if (value === 0) {
    return '0 GB';
  }
  const gb = value / 1024;
  const digits = gb >= 10 ? 0 : 1;
  return `${gb.toFixed(digits)} GB`;
}

function formatCount(value?: number | null) {
  if (value === null || value === undefined) {
    return 'Unlimited';
  }
  return NUMBER_FORMAT.format(value);
}

function formatEmailQuota(value?: number | null) {
  if (value === null || value === undefined) {
    return 'Unlimited per inbox';
  }
  if (value >= 1024) {
    return `${formatCapacityMb(value)} per inbox`;
  }
  return `${NUMBER_FORMAT.format(value)} MB per inbox`;
}

export interface HostingInfoEmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function buildHostingInfoEmail(
  content: HostingInfoEmailContent,
): HostingInfoEmailTemplate {
  const planName = content.planName ?? 'Custom plan';
  const storage = formatCapacityMb(content.storageMb);
  const bandwidth = formatCapacityMb(content.bandwidthMb);
  const hostingExpiration = formatDate(content.hostingExpirationDate ?? null);
  const assetLabel =
    content.siteUrl && content.siteUrl.trim().length > 0
      ? content.siteUrl
      : content.tenantName;
  const passwordResetText = content.passwordResetUrl
    ? `Reset your cPanel password here: ${content.passwordResetUrl}`
    : 'Need to reset your cPanel password? Contact support@theglorious.agency and we will take care of it for you.';
  const passwordResetHtml = content.passwordResetUrl
    ? `<a href="${content.passwordResetUrl}" style="color:#111;">Reset your cPanel password</a>`
    : 'Need to reset your cPanel password? Contact <a href="mailto:support@theglorious.agency">support@theglorious.agency</a> and we will take care of it for you.';

  const subject = 'Your hosting details from The Glorious Agency';

  const summaryRows = [
    { label: 'Plan', value: planName },
    { label: 'Storage', value: storage },
    { label: 'Bandwidth limit', value: bandwidth },
    { label: 'Databases', value: formatCount(content.databases) },
    { label: 'FTP users', value: formatCount(content.ftpUsers) },
    { label: 'Subdomains', value: formatCount(content.subdomains) },
    { label: 'Email accounts', value: formatCount(content.emailAccounts) },
    { label: 'Email quota', value: formatEmailQuota(content.emailQuotaMb) },
  ];

  const htmlRows = summaryRows
    .map(
      (row) => `<tr>
        <td style="padding:8px 12px;border:1px solid #eee;font-weight:600;">${row.label}</td>
        <td style="padding:8px 12px;border:1px solid #eee;">${row.value}</td>
      </tr>`,
    )
    .join('');

  const html = `<!DOCTYPE html>
<html>
  <body style="font-family: Arial, sans-serif; color: #111; line-height: 1.5; margin: 0; padding: 24px; background-color:#f8f8f8;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #eee;border-radius:12px;">
      <tr>
        <td style="padding:24px;">
          <h2 style="margin-top:0;">Welcome to The Glorious Agency Cloud Hosting</h2>
          <p>Here are the latest details for <strong>${assetLabel}</strong>. Keep this handy whenever you need to access or manage your hosting account.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:24px 0 16px 0;">
            ${htmlRows}
          </table>
          <p style="margin-bottom: 4px;"><strong>Coverage</strong></p>
          <p style="margin-top:0;">Paid through: ${hostingExpiration}</p>
          <p style="margin-bottom:16px;">
            <a href="${content.cpanelLoginUrl}" style="display:inline-block;padding:12px 20px;background:#111;color:#fff;text-decoration:none;border-radius:6px;">Login to cPanel</a>
          </p>
          <p>${passwordResetHtml}</p>
          <p style="margin-top:24px;">Let us know if you need anything else.<br />— The Glorious Agency Support Team</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    'Welcome to The Glorious Agency Cloud Hosting.',
    `Tenant: ${assetLabel}`,
    `Plan: ${planName}`,
    `Storage: ${storage}`,
    `Bandwidth limit: ${bandwidth}`,
    `Databases: ${formatCount(content.databases)}`,
    `FTP users: ${formatCount(content.ftpUsers)}`,
    `Subdomains: ${formatCount(content.subdomains)}`,
    `Email accounts: ${formatCount(content.emailAccounts)}`,
    `Email quota: ${formatEmailQuota(content.emailQuotaMb)}`,
    `Paid through: ${hostingExpiration}`,
    `Login to cPanel: ${content.cpanelLoginUrl}`,
    passwordResetText,
    '',
    '— The Glorious Agency Support Team',
  ].join('\n');

  return {
    subject,
    html,
    text,
  };
}

export type { HostingInfoEmailContent };
