'use agent';

import { defineTool, useDelivery, useModel, useTool } from '@flue/runtime';
import { type EventSource, normalize } from '../lib/normalize.ts';

type EventRequest = {
  source?: string;
  event?: Record<string, unknown>;
};

const sources: EventSource[] = ['sentry', 'pagerduty', 'gitlab-ci', 'cron', 'generic'];

function requestFromBody(body: string): EventRequest {
  try {
    return JSON.parse(body) as EventRequest;
  } catch {
    return {};
  }
}

function routeForSeverity(severity: string) {
  if (severity === 'critical') {
    return { action: 'page', channel: 'oncall', reason: 'Critical events require an immediate human response.' };
  }
  if (severity === 'high' || severity === 'medium') {
    return { action: 'notify', channel: 'eng-alerts', reason: 'Elevated events should be sent to the engineering alert channel.' };
  }
  return { action: 'log', channel: 'audit-log', reason: 'Informational events are recorded without interrupting responders.' };
}

export function EventTrigger() {
  useModel('cloudflare/@cf/moonshotai/kimi-k2.6');
  const delivery = useDelivery();
  const body = delivery.kind === 'user' ? delivery.body : '';

  useTool(
    defineTool({
      name: 'route_event',
      description: 'Normalize an authenticated event and choose its structured routing destination.',
      run() {
        const request = requestFromBody(body);
        const source = sources.includes(request.source as EventSource)
          ? (request.source as EventSource)
          : 'generic';
        const event = request.event ?? {};
        const canonical = normalize(source, event);
        return {
          output: {
            ok: true,
            handled: `${canonical.source}:${canonical.kind}`,
            event: {
              source: canonical.source,
              kind: canonical.kind,
              title: canonical.title,
              severity: canonical.severity,
              service: canonical.service,
              url: canonical.url,
            },
            route: routeForSeverity(canonical.severity),
          },
        };
      },
    }),
  );

  return 'Call route_event exactly once for every delivered event. Return its output as JSON without changing field names.';
}
