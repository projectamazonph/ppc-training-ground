/**
 * Sentry → Slack error spike alert.
 *
 * Sprint 11 / STORY-052.
 *
 * This script runs as a GitHub Actions cron job (or Vercel cron). It
 * pulls the issue counts from the Sentry API for the last hour and
 * posts a message to Slack if the count exceeds ALERT_THRESHOLD.
 *
 * Env vars required:
 *   SENTRY_API_TOKEN       - Sentry auth token (scope: project:read)
 *   SENTRY_ORG             - Sentry organization slug
 *   SENTRY_PROJECT         - Sentry project slug
 *   SENTRY_HOST            - optional, defaults to https://sentry.io
 *   SLACK_WEBHOOK_URL      - Incoming webhook URL
 *   ALERT_THRESHOLD        - integer, default 5
 *   WINDOW_MINUTES         - integer, default 60
 *
 * Usage:
 *   pnpm tsx scripts/sentry-slack-alert.ts             # alert-on-spike mode
 *   pnpm tsx scripts/sentry-slack-alert.ts --summary   # post daily summary
 */

interface SentryStatsResponse {
  groups?: Array<{
    title: string;
    count: number;
    lastSeen: string;
    permalink?: string;
    culprit?: string;
  }>;
  total?: number;
}

interface SlackBlock {
  type: string;
  text?: { type: string; text: string };
  fields?: Array<{ type: string; text: string }>;
}

interface SlackPayload {
  text: string;
  blocks?: SlackBlock[];
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function intEnv(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Env var ${name} must be an integer, got: ${v}`);
  return n;
}

async function fetchSentryStats(
  host: string,
  org: string,
  project: string,
  token: string,
  windowMinutes: number,
): Promise<SentryStatsResponse> {
  const statsUrl = `${host}/api/0/projects/${encodeURIComponent(org)}/${encodeURIComponent(project)}/issues/?statsPeriod=${windowMinutes}m&sort=date&limit=10`;
  const res = await fetch(statsUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sentry API ${res.status}: ${body.slice(0, 500)}`);
  }
  const groups = (await res.json()) as Array<{
    title: string;
    count: number;
    lastSeen: string;
    permalink?: string;
    culprit?: string;
  }>;
  const total = groups.reduce(
    (sum, g) => sum + (typeof g.count === "number" ? g.count : 0),
    0,
  );
  return { groups, total };
}

function buildSlackMessage(
  stats: SentryStatsResponse,
  windowMinutes: number,
  isSummary: boolean,
): SlackPayload {
  const groups = stats.groups ?? [];
  const total = stats.total ?? 0;
  const host = process.env.SENTRY_HOST ?? "https://sentry.io";
  const org = process.env.SENTRY_ORG ?? "";
  const project = process.env.SENTRY_PROJECT ?? "";
  const issuesUrl = `${host}/${org}/${project}/issues/?statsPeriod=${windowMinutes}m`;

  const headline = isSummary
    ? `:bar_chart: *Sentry Daily Summary* — last ${windowMinutes}m: *${total}* events across *${groups.length}* issues`
    : `:rotating_light: *Sentry Error Spike* — *${total}* events in last ${windowMinutes}m (threshold breached)`;

  const blocks: SlackBlock[] = [
    { type: "section", text: { type: "mrkdwn", text: headline } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<${issuesUrl}|View issues in Sentry>`,
      },
    },
  ];

  if (groups.length > 0) {
    const lines = groups
      .slice(0, 5)
      .map((g) => {
        const link = g.permalink ? `<${g.permalink}|${g.title}>` : `*${g.title}*`;
        return `• ${link} — \`${g.count}\` events (last: ${g.lastSeen})`;
      })
      .join("\n");
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Top issues:*\n${lines}` },
    });
  }

  return {
    text: isSummary
      ? `Sentry daily summary (${total} events)`
      : `Sentry error spike (${total} events)`,
    blocks,
  };
}

async function postToSlack(webhookUrl: string, payload: SlackPayload): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Slack webhook ${res.status}: ${body.slice(0, 500)}`);
  }
}

async function main(): Promise<void> {
  const isSummary = process.argv.includes("--summary");
  const host = process.env.SENTRY_HOST ?? "https://sentry.io";
  const org = required("SENTRY_ORG");
  const project = required("SENTRY_PROJECT");
  const token = required("SENTRY_API_TOKEN");
  const webhookUrl = required("SLACK_WEBHOOK_URL");
  const windowMinutes = intEnv("WINDOW_MINUTES", 60);
  const threshold = intEnv("ALERT_THRESHOLD", 5);

  console.log(
    `[sentry-slack-alert] mode=${isSummary ? "summary" : "spike"} host=${host} org=${org} project=${project} window=${windowMinutes}m threshold=${threshold}`,
  );

  const stats = await fetchSentryStats(host, org, project, token, windowMinutes);
  const total = stats.total ?? 0;

  if (isSummary) {
    await postToSlack(webhookUrl, buildSlackMessage(stats, windowMinutes, true));
    console.log(`[sentry-slack-alert] summary posted (${total} events)`);
    return;
  }

  if (total >= threshold) {
    await postToSlack(webhookUrl, buildSlackMessage(stats, windowMinutes, false));
    console.log(`[sentry-slack-alert] alert posted (${total} >= ${threshold})`);
    return;
  }

  console.log(
    `[sentry-slack-alert] no alert needed (${total} < ${threshold}); posting nothing`,
  );
}

main().catch((err) => {
  console.error("[sentry-slack-alert] fatal:", err);
  process.exit(1);
});