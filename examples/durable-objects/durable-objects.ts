// examples/durable-objects, per-user agent routing.
//
// Flue auto-creates a Durable Object class per agent file. Every path
// segment after `/agents/durable-objects/` becomes a separate DO
// instance with its own session storage. Two POSTs to the same path
// hit the same DO; two different paths hit different DOs.
//
// This example doesn't write to DO storage directly, it just shows
// the routing. See recipes/do-session for memory across turns and
// recipes/do-governor for explicit state machines.

import type { FlueContext } from '@flue/sdk/client';

export const triggers = { webhook: true };

export default async function ({ id, payload }: FlueContext) {
  // `id` is the path segment after the agent name, i.e. the DO instance id.
  return { id, message: payload.message ?? 'hi', note: 'Same id = same DO' };
}
