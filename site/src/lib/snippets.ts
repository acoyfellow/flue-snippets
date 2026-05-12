import { getCollection } from 'astro:content';

export type SnippetKind = 'examples' | 'recipes' | 'templates';

export interface Snippet {
  slug: string;
  title: string;
  tagline: string;
  composes: string[];
  kind: SnippetKind;
  /** The on-repo folder path, e.g. 'examples/workers-ai' */
  repoPath: string;
}

/**
 * The slug emitted by Astro's glob loader for a pattern like
 * '* /README.md' on an entry such as 'workers-ai/README.md' is
 * 'workers-ai/readme'. Strip the trailing '/readme' so we get the
 * folder name on its own.
 */
function folderFromId(id: string): string {
  // id looks like 'workers-ai/readme' or just 'workers-ai'
  const trimmed = id.replace(/\/readme$/i, '');
  return trimmed;
}

export async function loadSnippets(kind: SnippetKind): Promise<Snippet[]> {
  const entries = await getCollection(kind);
  return entries
    .map((entry): Snippet => {
      const slug = folderFromId(entry.id);
      return {
        slug,
        title: entry.data.title,
        tagline: entry.data.tagline,
        composes: entry.data.composes,
        kind,
        repoPath: `${kind}/${slug}`,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
