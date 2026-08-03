'use agent';

import { env } from 'cloudflare:workers';
import { type AgentProps, defineTool, useModel, useTool } from '@flue/runtime';
import * as v from 'valibot';

type VectorBinding = {
	upsert: (vectors: Array<{ id: string; values: number[]; metadata?: unknown }>) => Promise<unknown>;
	query: (values: number[], options?: { topK?: number; returnMetadata?: boolean | 'all' | 'none' | 'indexed' }) => Promise<{ matches: Array<{ id: string; score: number; metadata?: unknown }> }>;
};

type AiBinding = {
	run: (model: string, args: unknown) => Promise<{ data?: number[][] }>;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

async function embed(text: string): Promise<number[]> {
	const { AI } = env as unknown as { AI: AiBinding };
	const result = await AI.run('@cf/baai/bge-base-en-v1.5', { text });
	return result.data?.[0] ?? [];
}

const vectorizeRoundTrip = defineTool({
	name: 'vectorize_round_trip',
	description: 'Embed text, upsert it into Vectorize, query it, and report the result.',
	input: v.object({
		docText: v.optional(v.string()),
		queryText: v.optional(v.string()),
	}),
	async run({ data }) {
		const { VECTOR } = env as unknown as { VECTOR: VectorBinding };
		const docId = `doc-${Date.now()}`;
		const docText = data.docText ?? 'octarine is the colour of magic';
		const documentVector = await embed(docText);
		await VECTOR.upsert([{ id: docId, values: documentVector, metadata: { text: docText } }]);
		const queryVector = await embed(data.queryText ?? 'tell me the colour of magic');
		const result = await VECTOR.query(queryVector, { topK: 1, returnMetadata: 'all' });
		const topMatch = result.matches[0];
		return {
			output: {
				docId,
				dimensions: documentVector.length,
				topMatch: topMatch ? { id: topMatch.id, score: topMatch.score, metadata: topMatch.metadata as JsonValue } : null,
			},
		};
	},
});

export function Vectorize(_props: AgentProps) {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	useTool(vectorizeRoundTrip);
	return 'Call vectorize_round_trip exactly once with the document and query text the user gives you, then report the document id, embedding dimensions, and top match.';
}
