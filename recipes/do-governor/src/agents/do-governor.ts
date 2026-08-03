'use agent';

import { defineTool, useDelivery, useModel, usePersistentState, useTool } from '@flue/runtime';

type RunState = {
  cycle: number;
  recent: string[];
  stuckScore: number;
};

type Decision =
  | { action: 'continue' }
  | { action: 'reanchor'; instruction: string }
  | { action: 'ask-human'; question: string };

type GovernedRun = {
  state: RunState;
  decision: Decision;
};

function govern(state: RunState, event: string): GovernedRun {
  const recent = [...state.recent.slice(-4), event];
  const repeats = recent.filter((candidate) => candidate === event).length;
  const stuckScore = repeats >= 3 ? state.stuckScore + 1 : Math.max(0, state.stuckScore - 1);
  if (stuckScore >= 2) {
    return {
      state: { cycle: state.cycle + 1, recent, stuckScore },
      decision: { action: 'ask-human', question: 'I keep repeating the same move. What should change?' },
    };
  }
  if (stuckScore === 1) {
    return {
      state: { cycle: state.cycle + 1, recent, stuckScore },
      decision: {
        action: 'reanchor',
        instruction: 'Stop and restate the goal before trying a different approach.',
      },
    };
  }
  return {
    state: { cycle: state.cycle + 1, recent, stuckScore },
    decision: { action: 'continue' },
  };
}

export function DoGovernor() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  const delivery = useDelivery();
  const event = delivery.body;
  const [state, setState] = usePersistentState<RunState>('governor', {
    cycle: 0,
    recent: [],
    stuckScore: 0,
  });
  const governor = defineTool({
    name: 'govern',
    description: 'Record the current action in durable state and decide whether the agent should continue, reanchor, or ask a human for help.',
    run() {
      const governed = govern(state, event);
      setState(governed.state);
      return { output: governed };
    },
  });
  useTool(governor);
  return 'Call govern exactly once for the current user request. Report the resulting decision and state, then follow the decision in your response.';
}
