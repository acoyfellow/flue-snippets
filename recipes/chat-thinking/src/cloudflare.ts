// Cloudflare-only Worker extension: co-host the Think Durable Object.
// Named exports become top-level Worker exports; the binding + migration
// are declared in wrangler.jsonc.
import { Think } from '@cloudflare/think';
import { createWorkersAI } from 'workers-ai-provider';

interface Env {
  AI: unknown;
}

export class Thinker extends Think<Env> {
  getModel() {
    const workersAi = createWorkersAI({
      binding: this.env.AI as Parameters<typeof createWorkersAI>[0]['binding'],
    });
    return workersAi('@cf/moonshotai/kimi-k2.6');
  }
}
