import { env } from 'cloudflare:workers';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import * as v from 'valibot';

// recipes/virtual-sandbox — R2 holds the knowledge-base docs; the workflow
// seeds them into the agent's virtual sandbox (just-bash, in-memory) via
// harness.fs, then the agent greps /workspace/docs to answer. Flue 1.0
// workflow. No container, no vector DB, no embedding step.
//
// (Flue 1.0 replaced the 0.7 getVirtualSandbox(R2) FS-mount with the default
// virtual sandbox + harness.fs seeding; R2 remains the source of truth.)

interface Env {
  KB: R2Bucket;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({
  model: 'cloudflare/@cf/moonshotai/kimi-k2.6',
  cwd: '/workspace',
}));

export default defineWorkflow({
  agent,
  input: v.object({ message: v.string() }),
  output: v.object({ answer: v.string() }),
  async run({ harness, input }) {
    const { KB } = env as unknown as Env;
    // Seed two docs so the E2E is deterministic. In production you'd
    // populate R2 separately and list/copy whatever the agent needs.
    await KB.put('docs/colours.md', '# Colours\n\nOctarine is the colour of magic.\n');
    await KB.put('docs/policies.md', '# Policies\n\nAll support requests require ID.\n');

    // Copy the R2 docs into the agent's sandbox filesystem. harness.fs writes
    // from the sandbox ROOT (not the agent cwd), so write under /workspace so
    // the agent (cwd: /workspace) finds them at docs/.
    const list = await KB.list({ prefix: 'docs/' });
    for (const obj of list.objects) {
      const body = await KB.get(obj.key);
      if (body) await harness.fs.writeFile(`/workspace/${obj.key}`, await body.text());
    }

    const session = await harness.session();
    const response = await session.prompt(
      `Answer this question using only what you can grep from docs/: ${input.message}`,
    );
    return { answer: response.text };
  },
});
