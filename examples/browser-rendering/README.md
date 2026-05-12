---
title: browser-rendering
tagline: 'Real Chromium at the edge. Agent opens a page, returns the title.'
composes: [Browser Rendering]
---

# browser-rendering

> Real Chromium at the edge. Agent opens a page, returns the title.

```sh
bash examples/browser-rendering/run-e2e.sh
```

`puppeteer.launch(env.BROWSER)` spins up a headless Chrome session.
The agent navigates to a URL and returns `<title>`. Cold start is
heavier than Workers AI; `run-e2e.sh` allows 180s for the warmup
POST.
