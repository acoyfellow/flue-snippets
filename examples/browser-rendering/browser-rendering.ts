// examples/browser-rendering, agent opens a real Chromium, fetches a
// page, returns the title.

import puppeteer from '@cloudflare/puppeteer';
import type { FlueContext } from '@flue/sdk/client';

interface Env {
  BROWSER: Fetcher;
}

export const triggers = { webhook: true };

export default async function ({ payload, env }: FlueContext & { env: Env }) {
  const url = String(payload.url ?? 'https://example.com');
  const browser = await puppeteer.launch(env.BROWSER);
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'load' });
    const title = await page.title();
    return { url, title };
  } finally {
    await browser.close();
  }
}
