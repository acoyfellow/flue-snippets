import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// recipes/do-governor — a tiny control layer for long-running agents: record
// each cycle, detect repetition, and change the next instruction when the
// agent starts looping. Flue 1.0 workflow: caller threads state in/out.
//
// The govern() decision is deterministic (not model-dependent). When the
// governor says "continue"/"reanchor" the workflow also runs a model turn;
// "ask-human" short-circuits without one.

type RunState = { cycle: number; recent: string[]; stuckScore: number };

function govern(state: RunState, event: string) {
  const recent = [...state.recent.slice(-4), event];
  const repeats = recent.filter((x) => x === event).length;
  const stuckScore = repeats >= 3 ? state.stuckScore + 1 : Math.max(0, state.stuckScore - 1);
  if (stuckScore >= 2) {
    return {
      next: {
        action: 'ask-human' as const,
        question: 'I keep repeating the same move. What should change?',
      },
      state: { cycle: state.cycle + 1, recent, stuckScore },
    };
  }
  if (stuckScore === 1) {
    return {
      next: {
        action: 'reanchor' as const,
        instruction: 'Stop and restate the goal before trying a different approach.',
      },
      state: { cycle: state.cycle + 1, recent, stuckScore },
    };
  }
  return {
    next: { action: 'continue' as const },
    state: { cycle: state.cycle + 1, recent, stuckScore },
  };
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const stateSchema = v.object({
  cycle: v.number(),
  recent: v.array(v.string()),
  stuckScore: v.number(),
});
const decisionSchema = v.object({
  action: v.picklist(['continue', 'reanchor', 'ask-human']),
  instruction: v.optional(v.string()),
  question: v.optional(v.string()),
});

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({
    state: v.optional(stateSchema),
    lastAction: v.optional(v.string()),
    message: v.optional(v.string()),
  }),
  output: v.object({
    state: stateSchema,
    decision: decisionSchema,
    answer: v.optional(v.string()),
  }),
  async run({ harness, input }) {
    const previous: RunState = input.state ?? { cycle: 0, recent: [], stuckScore: 0 };
    const event = input.lastAction ?? input.message ?? 'unknown';
    const { next, state } = govern(previous, event);
    if (next.action === 'ask-human') return { state, decision: next };
    const session = await harness.session();
    if (next.action === 'reanchor') await session.prompt(next.instruction);
    const response = await session.prompt(input.message ?? 'continue');
    return { state, decision: next, answer: response.text };
  },
});
