// batch-a/04-unsurf-trace — Flue + unsurf
//
// A Flue agent that browses a URL, captures every action as a typed
// trace (proof-spec.v0), and returns a video + JSON receipt.

import type { FlueContext } from '@flue/sdk/client';
import { observe } from '@acoyfellow/unsurf';

export const triggers = { webhook: true };

export default async function ({ init, payload, env }: FlueContext) {
  const trace = await observe(payload.url, {
    actions: payload.actions ?? [
      { type: 'wait', selector: 'body' },
      { type: 'screenshot' },
    ],
    record: true,
  });

  const agent = await init({ model: 'anthropic/claude-sonnet-4-6' });
  const session = await agent.session();

  // Hand the trace to the agent for analysis.
  const summary = await session.prompt(
    `Summarize what happened on ${payload.url}:\n` +
    `${trace.actions.length} actions, ${trace.assertions.length} assertions.\n` +
    `Trace: ${JSON.stringify(trace, null, 2)}`
  );

  return {
    summary,
    video: trace.recordingUrl,
    proofSpec: trace.proofSpecUrl,
  };
}
