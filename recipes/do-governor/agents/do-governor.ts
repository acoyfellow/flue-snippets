// batch-d/16-do-governor — Flue + persistent run governor
//
// A tiny control layer for long-running agents: record each cycle, detect
// repetition, and change the next instruction when the agent starts looping.

import type { FlueContext } from '@flue/sdk/client';

export const triggers = { webhook: true };

type RunState = {
  cycle: number;
  recent: string[];
  stuckScore: number;
};

function govern(state: RunState, event: string) {
  const recent = [...state.recent.slice(-4), event];
  const repeats = recent.filter((x) => x === event).length;
  const stuckScore = repeats >= 3 ? state.stuckScore + 1 : Math.max(0, state.stuckScore - 1);

  if (stuckScore >= 2) {
    return {
      next: {
        action: 'ask-human',
        question: 'I keep repeating the same move. What should change?',
      },
      state: { cycle: state.cycle + 1, recent, stuckScore },
    };
  }

  if (stuckScore === 1) {
    return {
      next: {
        action: 'reanchor',
        instruction: 'Stop and restate the goal before trying a different approach.',
      },
      state: { cycle: state.cycle + 1, recent, stuckScore },
    };
  }

  return { next: { action: 'continue' }, state: { cycle: state.cycle + 1, recent, stuckScore } };
}

export default async function ({ init, payload }: FlueContext) {
  const agent = await init({
    model: 'cloudflare-workers-ai/@cf/moonshotai/kimi-k2.6',
  });
  const session = await agent.session();

  // Minimal snippet form: caller sends prior state and stores returned state.
  // The alchemy.run.ts sketch shows where this graduates to a DO binding.
  const previous = (payload.state ?? { cycle: 0, recent: [], stuckScore: 0 }) as RunState;
  const event = payload.lastAction ?? payload.message ?? 'unknown';
  const { next, state } = govern(previous, event);

  if (next.action === 'reanchor') await session.prompt(next.instruction);
  if (next.action === 'ask-human') return { state, decision: next };

  const answer = await session.prompt(payload.message ?? 'continue');
  return { state, decision: next, answer };
}
