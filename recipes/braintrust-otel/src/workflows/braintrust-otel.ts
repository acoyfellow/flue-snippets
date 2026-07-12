import { env } from 'cloudflare:workers';
import { BraintrustSpanProcessor } from '@braintrust/otel';
import { defineAgent, defineWorkflow, type WorkflowRouteHandler } from '@flue/runtime';
import { SpanStatusCode } from '@opentelemetry/api';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import * as v from 'valibot';

// recipes/braintrust-otel — Flue 1.0 workflow + OpenTelemetry exported to
// Braintrust. Records attributes/timing only (no prompt/answer content).

interface Env {
  BRAINTRUST_API_KEY: string;
  BRAINTRUST_PROJECT: string;
}

export const route: WorkflowRouteHandler = async (_c, next) => next();

const agent = defineAgent(() => ({ model: 'cloudflare/@cf/moonshotai/kimi-k2.6' }));

export default defineWorkflow({
  agent,
  input: v.object({ message: v.optional(v.string()) }),
  output: v.object({ answer: v.string(), project: v.string(), otelFlushCompleted: v.boolean() }),
  async run({ harness, input }) {
    const e = env as unknown as Env;
    const message = input.message ?? 'Say hi.';
    const processor = new BraintrustSpanProcessor({
      apiKey: e.BRAINTRUST_API_KEY,
      parent: `project_name:${e.BRAINTRUST_PROJECT}`,
      filterAISpans: true,
    });
    const provider = new BasicTracerProvider({ spanProcessors: [processor] });
    const tracer = provider.getTracer('flue-snippets/braintrust-otel');
    const span = tracer.startSpan('gen_ai.flue.workers_ai.prompt', {
      attributes: {
        'gen_ai.operation.name': 'chat',
        'gen_ai.provider.name': 'cloudflare.workers-ai',
        'flue.recipe': 'braintrust-otel',
        'flue.input.characters': message.length,
      },
    });
    try {
      const session = await harness.session();
      const response = await session.prompt(message);
      span.setAttributes({ 'flue.output.characters': response.text.length });
      span.setStatus({ code: SpanStatusCode.OK });
      return { answer: response.text, project: e.BRAINTRUST_PROJECT, otelFlushCompleted: true };
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
      // Bound the flush: in workerd the OTLP export can hang if the endpoint
      // is slow/unreachable. Race it so the workflow always returns.
      await Promise.race([
        provider.forceFlush().catch(() => undefined),
        new Promise((r) => setTimeout(r, 8000)),
      ]);
    }
  },
});
