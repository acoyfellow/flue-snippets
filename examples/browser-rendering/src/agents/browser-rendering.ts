'use agent';

import puppeteer from '@cloudflare/puppeteer';
import { env } from 'cloudflare:workers';
import { type AgentProps, defineTool, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';

interface Env {
	BROWSER: Fetcher;
}

const renderPage = defineTool({
	name: 'render_page',
	description: 'Open a URL with Cloudflare Browser Rendering and return its page title.',
	input: v.object({
		url: v.string(),
	}),
	async run({ data }) {
		const { BROWSER } = env as unknown as Env;
		const browser = await puppeteer.launch(BROWSER);
		try {
			const page = await browser.newPage();
			await page.goto(data.url, { waitUntil: 'load' });
			const title = await page.title();
			return { output: { url: data.url, title } };
		} finally {
			await browser.close();
		}
	},
});

export function BrowserRendering(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useTool(renderPage);
	return 'When the user gives a URL, call render_page exactly once and report the returned page title.';
}
