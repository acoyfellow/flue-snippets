import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const snippetSchema = z.object({
  title: z.string(),
  tagline: z.string(),
  composes: z.array(z.string()),
});

export const collections = {
  examples: defineCollection({
    loader: glob({ pattern: '*/README.md', base: '../examples' }),
    schema: snippetSchema,
  }),
  recipes: defineCollection({
    loader: glob({ pattern: '*/README.md', base: '../recipes' }),
    schema: snippetSchema,
  }),
  templates: defineCollection({
    loader: glob({ pattern: '*/README.md', base: '../templates' }),
    schema: snippetSchema,
  }),
};
