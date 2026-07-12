import { env } from 'cloudflare:workers';
import puppeteer from '@cloudflare/puppeteer';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// examples/browser-rendering — open a real Chromium, fetch a page, return the
// title. Flue 1.0 workflow using the Browser Rendering binding directly.

interface Env {
  BROWSER: Fetcher;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ url: v.optional(v.string()) }),
  output: v.object({ url: v.string(), title: v.string() }),
  async run({ input }) {
    const { BROWSER } = env as unknown as Env;
    const url = input.url ?? 'https://example.com';
    const browser = await puppeteer.launch(BROWSER);
    try {
      const page = await browser.newPage();
      await page.goto(url, { waitUntil: 'load' });
      const title = await page.title();
      return { url, title };
    } finally {
      await browser.close();
    }
  },
});
