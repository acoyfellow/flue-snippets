// batch-c/14-queue-unsurf — Flue + Queues + unsurf
//
// A scheduled regression check: every hour, cron enqueues N URLs.
// Queue consumer runs unsurf against each, captures the trace, and if
// any assertion fails, the proof URL goes to the alert channel.

import type { FlueContext } from '@flue/sdk/client';
import { observe } from 'unsurf';

export const triggers = { webhook: true };

// The agent: handles one URL from the queue.
export default async function ({ init, payload, env }: FlueContext) {
  const trace = await observe(payload.url, {
    actions: payload.actions,
    record: true,
  });

  if (trace.assertions.some(a => !a.passed)) {
    // Failed regression — surface the proof URL to operators.
    await env.ALERTS.send({
      url: payload.url,
      proof: trace.proofSpecUrl,
      video: trace.recordingUrl,
      failingAssertions: trace.assertions.filter(a => !a.passed),
    });
    return { ok: false, alerted: true };
  }

  return { ok: true, proof: trace.proofSpecUrl };
}

// Worker shell: cron + queue consumer.
export const worker = {
  async scheduled(_event: unknown, env: Env) {
    for (const url of env.MONITORED_URLS) {
      await env.REGRESSION_QUEUE.send({ url, actions: env.DEFAULT_ACTIONS });
    }
  },
};

interface Env {
  ALERTS: { send(msg: unknown): Promise<void> };
  REGRESSION_QUEUE: { send(msg: unknown): Promise<void> };
  MONITORED_URLS: string[];
  DEFAULT_ACTIONS: any[];
}
