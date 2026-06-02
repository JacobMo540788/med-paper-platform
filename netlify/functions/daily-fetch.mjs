export default async function handler() {
  const siteUrl = process.env.URL || process.env.DEPLOY_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const cronSecret = process.env.CRON_SECRET;

  if (!siteUrl || !cronSecret) {
    console.error("Missing URL/NEXT_PUBLIC_SITE_URL or CRON_SECRET.");
    return;
  }

  const response = await fetch(`${siteUrl}/api/cron/daily-fetch`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${cronSecret}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Daily fetch failed with ${response.status}: ${body}`);
  }
}
