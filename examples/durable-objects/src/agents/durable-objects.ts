'use agent';

// examples/durable-objects: per-instance agent routing via Durable Objects.
// Flue creates one DO instance per path id: POST /agents/durable-objects/<id>.
// Same id = same DO = same conversation history; a new id = a fresh instance.
// Flue owns the session store on Cloudflare.
//
// Flue 2: the agent IS this function. The instruction string it returns
// replaces the old `instructions` config field, and conversation history is
// still handled by the runtime, and nothing here reads or writes it.

import { useModel } from '@flue/runtime';

export function DurableObjects() {
	useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
	return 'You are a concise assistant. Answer in one short sentence and use the conversation history to recall anything the user told you earlier.';
}
