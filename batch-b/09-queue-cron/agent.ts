// batch-b/09-queue-cron — Flue + Cloudflare Queues + Cron Triggers
//
// A scheduled Flue agent: cron fires every 15 min, enqueues an objective,
// queue consumer runs the agent. Failures retry with exponential backoff.
// The local rig (the-machine) lifted into the cloud.

import type { FlueContext } from '@flue/sdk/client';

// The agent itself: standard Flue handler.
export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const agent = await init({ model: 'anthropic/claude-sonnet-4-6' });
  const session = await agent.session();
  return await session.skill('rig-objective', { args: payload });
}

// The Worker shell that wraps it: cron + queue.
// (Configured in wrangler.toml — see README.)
export const worker = {
  async scheduled(_event: unknown, env: Env) {
    // Every 15 min, enqueue the next rig objective.
    await env.RIG_JOBS.send({ objective: env.CURRENT_OBJECTIVE });
  },

  async queue(batch: any, env: Env) {
    for (const msg of batch.messages) {
      try {
        await runFlueAgent('09-queue-cron', msg.body, env);
        msg.ack();
      } catch (e) {
        msg.retry({ delaySeconds: 60 });  // exponential backoff is built in
      }
    }
  },
};

interface Env { RIG_JOBS: Queue; CURRENT_OBJECTIVE: string }
declare function runFlueAgent(name: string, payload: any, env: Env): Promise<unknown>;
declare interface Queue { send(msg: unknown): Promise<void> }
