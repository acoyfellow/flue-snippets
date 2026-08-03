'use agent';

import { env } from 'cloudflare:workers';
import { bash, defineTool, useModel, useSandbox, useTool } from '@flue/runtime';
import { Bash, InMemoryFs } from 'just-bash';

type RuntimeEnv = { KB: R2Bucket };

export function VirtualSandbox() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  useSandbox(
    bash(
      () =>
        new Bash({
          fs: new InMemoryFs({
            '/workspace/docs/colours.md': '# Colours\n\nOctarine is the colour of magic.\n',
            '/workspace/docs/policies.md': '# Policies\n\nAll support requests require ID.\n',
          }),
        }),
    ),
    { cwd: '/workspace' },
  );

  useTool(
    defineTool({
      name: 'seed_knowledge_base',
      description: 'Copy the R2 knowledge-base documents into the virtual sandbox filesystem.',
      harness: true,
      async run({ harness }) {
        const { KB } = env as unknown as RuntimeEnv;
        await KB.put('docs/colours.md', '# Colours\n\nOctarine is the colour of magic.\n');
        await KB.put('docs/policies.md', '# Policies\n\nAll support requests require ID.\n');
        const listed = await KB.list({ prefix: 'docs/' });
        const files: string[] = [];
        for (const object of listed.objects) {
          const body = await KB.get(object.key);
          if (!body) continue;
          await harness.sandbox.writeFile(`/workspace/${object.key}`, await body.text());
          files.push(object.key);
        }
        return { output: { files } };
      },
    }),
  );

  return 'Call seed_knowledge_base exactly once, then use the sandbox tools to inspect docs and answer the user using only those documents.';
}
