---
title: browser-rendering
tagline: 'Real Chromium at the edge. Agent opens a page, returns the title.'
composes: [Browser Rendering, Workers AI]
---

# browser-rendering

> Real Chromium at the edge. Agent opens a page, returns the title.

```sh
bash examples/browser-rendering/run-e2e.sh
```

`BrowserRendering` is a synchronous Flue 2 agent. It uses Workers AI to
interpret a requested URL and mounts the `render_page` tool with `useTool()`.
That tool uses `puppeteer.launch(env.BROWSER)` to start a headless Chrome
session, navigate to the URL, and return its `<title>`.

The Browser Rendering binding remains in `wrangler.jsonc` alongside the
Workers AI binding. The E2E builds and deploys the Worker, POSTs the request
to `/agents/browser-rendering/<conversationId>`, polls the same URL for the
`Example Domain` title, then deletes the Worker. Cold starts are heavier than
model-only agents, so the harness allows 180 seconds per browser request.
