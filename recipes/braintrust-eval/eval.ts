/**
 * Braintrust experiment over a deployed Flue endpoint.
 *
 * Run with `AGENT_URL=... bunx braintrust eval eval.ts --no-input` after deployment.
 * The Braintrust CLI uses BRAINTRUST_API_KEY from the caller's environment.
 */

import { Eval } from 'braintrust';

const AGENT_URL = process.env.AGENT_URL;
if (!AGENT_URL) throw new Error('AGENT_URL is required');

interface Output {
  answer: string;
}

Eval('flue-snippets', {
  experimentName: 'braintrust-eval / deployed Workers AI agent',
  data: [
    {
      input: { message: 'Reply with exactly the word: observability' },
      expected: 'observability',
    },
    {
      input: { message: 'Reply with exactly the word: trace' },
      expected: 'trace',
    },
  ],
  task: async (input): Promise<Output> => {
    const response = await fetch(AGENT_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (!response.ok) throw new Error(`Flue endpoint returned HTTP ${response.status}`);
    const body = (await response.json()) as { result?: { answer?: string } };
    if (!body.result?.answer) throw new Error('Flue endpoint returned no answer');
    return { answer: body.result.answer };
  },
  scores: [
    ({ output, expected }) => ({
      name: 'contains_requested_word',
      score: output.answer.toLowerCase().includes(expected.toLowerCase()) ? 1 : 0,
    }),
  ],
  metadata: { target: 'cloudflare-worker', provider: 'workers-ai', recipe: 'braintrust-eval' },
});
