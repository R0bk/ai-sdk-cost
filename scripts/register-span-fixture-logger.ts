import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { registerSpanSampleLogger } from '../src/telemetry';
import type { SpanSampleLogger } from '../src/telemetry';

const LOG_DIR = process.env.AI_SDK_COST_SPAN_LOG_DIR ?? join(process.cwd(), 'logs');
const LOG_FILE = process.env.AI_SDK_COST_SPAN_LOG_FILE ?? 'call-llm-span-samples.ndjson';

const enable = process.env.AI_SDK_COST_CAPTURE_SPANS === 'true';

if (!enable) {
  registerSpanSampleLogger(undefined);
} else {
  const ensureWriter = (): void => {
    mkdirSync(LOG_DIR, { recursive: true });
  };

  const logger: SpanSampleLogger = span => {
    ensureWriter();
    const payload = {
      name: span.name,
      attributes: span.attributes,
      traceId: span.spanContext().traceId,
      spanId: span.spanContext().spanId
    };
    appendFileSync(join(LOG_DIR, LOG_FILE), `${JSON.stringify(payload)}\n`, 'utf8');
  };

  registerSpanSampleLogger(logger);
}
