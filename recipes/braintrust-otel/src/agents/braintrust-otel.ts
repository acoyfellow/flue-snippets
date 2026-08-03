'use agent';

import { env } from 'cloudflare:workers';
import { BraintrustSpanProcessor } from '@braintrust/otel';
import { defineTool, useModel, useTool } from '@flue/runtime';
import { SpanStatusCode } from '@opentelemetry/api';
import { BasicTracerProvider } from '@opentelemetry/sdk-trace-base';
import * as v from 'valibot';

interface Env {
  BRAINTRUST_API_KEY: string;
  BRAINTRUST_PROJECT: string;
}

const braintrustOtelPrompt = defineTool({
  name: 'braintrust_otel_prompt',
  description: 'Answer a request with Workers AI while exporting a minimal OpenTelemetry model span to Braintrust.',
  input: v.object({ message: v.string() }),
  harness: true,
  async run({ data, harness }) {
    const configuration = env as unknown as Env;
    const processor = new BraintrustSpanProcessor({
      apiKey: configuration.BRAINTRUST_API_KEY,
      parent: `project_name:${configuration.BRAINTRUST_PROJECT}`,
      filterAISpans: true,
    });
    const provider = new BasicTracerProvider({ spanProcessors: [processor] });
    const tracer = provider.getTracer('flue-snippets/braintrust-otel');
    const span = tracer.startSpan('gen_ai.flue.workers_ai.prompt', {
      attributes: {
        'gen_ai.operation.name': 'chat',
        'gen_ai.provider.name': 'cloudflare.workers-ai',
        'flue.recipe': 'braintrust-otel',
        'flue.input.characters': data.message.length,
      },
    });
    try {
      const response = await harness.prompt(data.message);
      span.setAttributes({ 'flue.output.characters': response.text.length });
      span.setStatus({ code: SpanStatusCode.OK });
      return {
        output: {
          answer: response.text,
          project: configuration.BRAINTRUST_PROJECT,
          otelFlushCompleted: true,
        },
      };
    } catch (error) {
      span.recordException(error instanceof Error ? error : new Error(String(error)));
      span.setStatus({ code: SpanStatusCode.ERROR });
      throw error;
    } finally {
      span.end();
      await Promise.race([
        provider.forceFlush().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 8000)),
      ]);
    }
  },
});

export function BraintrustOtel() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  useTool(braintrustOtelPrompt);
  return 'For every user request, call braintrust_otel_prompt exactly once with the request, then return its answer.';
}
