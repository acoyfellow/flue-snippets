// recipes/event-trigger/lib/normalize.ts
//
// The thread's hard part, restated: "getting teams of the services we'd
// want notifications out of to help us get generic webhook support."
// The services (Sentry, PagerDuty, GitLab CI, cron, …) each send a
// different JSON shape. This module collapses those shapes into ONE
// canonical event so the downstream Flue workflow reasons over a single
// vocabulary instead of N provider schemas.
//
// Add a new source = add a branch here + (optionally) a signing quirk in
// verify-signature.ts. Everything past this boundary is source-agnostic.

export type EventSource = 'sentry' | 'pagerduty' | 'gitlab-ci' | 'cron' | 'generic';

export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface CanonicalEvent {
  source: EventSource;
  kind: string; // e.g. "error.created", "incident.triggered", "pipeline.failed"
  title: string;
  severity: Severity;
  service: string | null; // which upstream service/project the event is about
  url: string | null; // deep link back to the source, if the payload carried one
  raw: Record<string, unknown>; // the original body, minus the transport shim
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' && v.length > 0 ? v : fallback;
}

function get(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

// Map a source's own severity/level vocabulary onto the canonical scale.
function mapSeverity(source: EventSource, raw: Record<string, unknown>): Severity {
  if (source === 'sentry') {
    const level = str(get(raw, 'data.event.level') ?? get(raw, 'level'), 'error');
    if (level === 'fatal') return 'critical';
    if (level === 'error') return 'high';
    if (level === 'warning') return 'medium';
    return 'low';
  }
  if (source === 'pagerduty') {
    const urgency = str(get(raw, 'event.data.urgency') ?? get(raw, 'urgency'), 'high');
    return urgency === 'high' ? 'critical' : 'medium';
  }
  if (source === 'gitlab-ci') {
    const status = str(get(raw, 'object_attributes.status') ?? get(raw, 'build_status'));
    return status === 'failed' ? 'high' : 'info';
  }
  return 'info';
}

export function normalize(source: EventSource, raw: Record<string, unknown>): CanonicalEvent {
  const severity = mapSeverity(source, raw);

  switch (source) {
    case 'sentry': {
      const action = str(get(raw, 'action'), 'created');
      return {
        source,
        kind: `error.${action}`,
        title: str(
          get(raw, 'data.event.title') ?? get(raw, 'data.issue.title') ?? get(raw, 'message'),
          'Sentry event',
        ),
        severity,
        service: str(get(raw, 'data.event.project') ?? get(raw, 'project')) || null,
        url: str(get(raw, 'data.event.web_url') ?? get(raw, 'url')) || null,
        raw,
      };
    }
    case 'pagerduty': {
      const eventType = str(get(raw, 'event.event_type') ?? get(raw, 'event_type'), 'triggered');
      return {
        source,
        kind: `incident.${eventType.replace(/^incident\./, '')}`,
        title: str(
          get(raw, 'event.data.title') ?? get(raw, 'event.data.summary'),
          'PagerDuty incident',
        ),
        severity,
        service: str(get(raw, 'event.data.service.summary')) || null,
        url: str(get(raw, 'event.data.html_url')) || null,
        raw,
      };
    }
    case 'gitlab-ci': {
      const status = str(
        get(raw, 'object_attributes.status') ?? get(raw, 'build_status'),
        'unknown',
      );
      const kindBase = str(get(raw, 'object_kind'), 'pipeline');
      return {
        source,
        kind: `${kindBase}.${status}`,
        title: str(
          get(raw, 'object_attributes.name') ?? get(raw, 'build_name'),
          `GitLab ${kindBase} ${status}`,
        ),
        severity,
        service: str(get(raw, 'project.path_with_namespace') ?? get(raw, 'project_name')) || null,
        url: str(get(raw, 'object_attributes.url') ?? get(raw, 'project.web_url')) || null,
        raw,
      };
    }
    case 'cron': {
      return {
        source,
        kind: str(get(raw, 'kind'), 'cron.tick'),
        title: str(get(raw, 'title'), 'Scheduled trigger'),
        severity: 'info',
        service: str(get(raw, 'service')) || null,
        url: null,
        raw,
      };
    }
    default: {
      // generic: trust a small set of top-level fields, fall back safely.
      const sev = str(get(raw, 'severity')) as Severity;
      const allowed: Severity[] = ['info', 'low', 'medium', 'high', 'critical'];
      return {
        source: 'generic',
        kind: str(get(raw, 'kind'), 'event'),
        title: str(get(raw, 'title'), 'Generic event'),
        severity: allowed.includes(sev) ? sev : 'info',
        service: str(get(raw, 'service')) || null,
        url: str(get(raw, 'url')) || null,
        raw,
      };
    }
  }
}
