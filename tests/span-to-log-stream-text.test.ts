import assert from 'node:assert/strict';
import { Attributes, SpanKind, SpanStatusCode, type HrTime, type SpanContext } from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { spanToLog, type ExporterOptions } from '../src/telemetry';
import type { CallLlmSpanAttributes } from '../src/telemetry-types';

import anthropicNoCache from './fixtures/stream-text/anthropic-no-cache.json' assert { type: 'json' };
import anthropicWithCache from './fixtures/stream-text/anthropic-with-cache.json' assert { type: 'json' };
import googleNoCache from './fixtures/stream-text/google-no-cache.json' assert { type: 'json' };
import googleWithCache from './fixtures/stream-text/google-with-cache.json' assert { type: 'json' };
import openaiNoCache from './fixtures/stream-text/openai-no-cache.json' assert { type: 'json' };
import openaiWithCache from './fixtures/stream-text/openai-with-cache.json' assert { type: 'json' };
import xaiNoCache from './fixtures/stream-text/xai-no-cache.json' assert { type: 'json' };
import mistralNoCache from './fixtures/stream-text/mistral-no-cache.json' assert { type: 'json' };

type SpanFixture = {
  name: string;
  attributes: CallLlmSpanAttributes;
  traceId?: string;
  spanId?: string;
  startTime?: HrTime;
  endTime?: HrTime;
};

const asFixture = (raw: unknown): SpanFixture => {
  const candidate = raw as { name: string; attributes: CallLlmSpanAttributes }; 
  if (!candidate || typeof candidate.name !== 'string') {
    throw new Error('Invalid fixture: missing span name');
  }
  return {
    name: candidate.name,
    attributes: candidate.attributes,
    traceId: (candidate as any).traceId,
    spanId: (candidate as any).spanId,
    startTime: (candidate as any).startTime,
    endTime: (candidate as any).endTime
  };
};

const fixtures = {
  openaiNoCache: asFixture(openaiNoCache),
  openaiWithCache: asFixture(openaiWithCache),
  googleNoCache: asFixture(googleNoCache),
  googleWithCache: asFixture(googleWithCache),
  anthropicNoCache: asFixture(anthropicNoCache),
  anthropicWithCache: asFixture(anthropicWithCache),
  xaiNoCache: asFixture(xaiNoCache),
  mistralNoCache: asFixture(mistralNoCache),
};

const DEFAULT_TRACE_ID = '0000000000000000000000000000abc1';
const DEFAULT_SPAN_ID = '000000000000abc1';
const DEFAULT_START: HrTime = [0, 0];
const DEFAULT_END: HrTime = [1, 0];

const makeSpan = (fixture: SpanFixture): ReadableSpan => {
  const traceId = fixture.traceId ?? DEFAULT_TRACE_ID;
  const spanId = fixture.spanId ?? DEFAULT_SPAN_ID;
  const startTime = fixture.startTime ?? DEFAULT_START;
  const endTime = fixture.endTime ?? DEFAULT_END;

  const instrumentationScope = { name: 'test', version: '0.0.0' } as any;

  const span: ReadableSpan = {
    name: fixture.name,
    kind: SpanKind.INTERNAL,
    spanContext: () => ({ traceId, spanId, traceFlags: 1 }) as SpanContext,
    parentSpanContext: undefined,
    startTime,
    endTime,
    status: { code: SpanStatusCode.UNSET },
    attributes: fixture.attributes as unknown as Attributes,
    links: [],
    events: [],
    duration: [endTime[0] - startTime[0], endTime[1] - startTime[1]],
    ended: true,
    resource: { attributes: {} } as any,
    instrumentationScope,
    droppedAttributesCount: 0,
    droppedEventsCount: 0,
    droppedLinksCount: 0
  };

  return span;
};

const exportOptions: ExporterOptions = {};

const toLog = (fixture: SpanFixture) => {
  const span = makeSpan(fixture);
  const log = spanToLog(span, exportOptions);
  assert.ok(log, 'Expected span to produce a token log');
  return log!;
};

const expectProvider = (provider: string | null | undefined, fragment: string) => {
  assert.ok(provider, 'provider should be defined');
  assert.ok(
    provider!.toLowerCase().includes(fragment),
    `expected provider ${provider} to include ${fragment}`
  );
};

(() => {
  const log = toLog(fixtures.openaiNoCache);
  expectProvider(log.provider, 'openai');
  assert.equal(log.input, 2221);
  assert.equal(log.output, 563);
  assert.equal(log.cache_read, 0);
  assert.equal(log.cache_write, 0);
  assert.equal(log.user_id, "user-1");
  assert.equal(log.workspace_id, "workspace-1");
})();

(() => {
  const log = toLog(fixtures.openaiWithCache);
  expectProvider(log.provider, 'openai');
  assert.equal(log.input, 173);
  assert.equal(log.output, 444);
  assert.equal(log.cache_read, 2048);
  assert.equal(log.cache_write, 0);
  assert.equal(log.user_id, "user-2");
  assert.equal(log.workspace_id, "workspace-2");
})();

(() => {
  const log = toLog(fixtures.googleNoCache);
  expectProvider(log.provider, 'google');
  assert.equal(log.input, 2414);
  assert.equal(log.output, 532);
  assert.equal(log.cache_read, 0);
  assert.equal(log.cache_write, 0);
  assert.equal(log.user_id, "user-3");
  assert.equal(log.workspace_id, "workspace-3");
})();

(() => {
  const log = toLog(fixtures.googleWithCache);
  expectProvider(log.provider, 'google');
  assert.equal(log.input, 389);
  assert.equal(log.output, 239);
  assert.equal(log.cache_read, 2025);
  assert.equal(log.cache_write, 0);
  assert.equal(log.user_id, "user-4");
  assert.equal(log.workspace_id, "workspace-4");
})();

(() => {
  const log = toLog(fixtures.anthropicNoCache);
  expectProvider(log.provider, 'anthropic');
  assert.equal(log.input, 4);
  assert.equal(log.output, 138);
  assert.equal(log.cache_read, 0);
  assert.equal(log.cache_write, 2906);
  assert.equal(log.user_id, "user-5");
  assert.equal(log.workspace_id, "workspace-5");
})();

(() => {
  const log = toLog(fixtures.anthropicWithCache);
  expectProvider(log.provider, 'anthropic');
  assert.equal(log.input, 4);
  assert.equal(log.output, 108);
  assert.equal(log.cache_read, 2906);
  assert.equal(log.cache_write, 0);
  assert.equal(log.user_id, "user-6");
  assert.equal(log.workspace_id, "workspace-6");
})();

(() => {
  const log = toLog(fixtures.xaiNoCache);
  expectProvider(log.provider, 'xai');
  assert.equal(log.input, 2166);
  assert.equal(log.output, 598);
  assert.equal(log.cache_read, 0);
  assert.equal(log.cache_write, 0);
  assert.equal(log.user_id, "demo-user-xai");
  assert.equal(log.workspace_id, "demo-workspace-xai");
})();

(() => {
  const log = toLog(fixtures.mistralNoCache);
  expectProvider(log.provider, 'mistral');
  assert.equal(log.input, 2216);
  assert.equal(log.output, 740);
  assert.equal(log.cache_read, 0);
  assert.equal(log.cache_write, 0);
  assert.equal(log.user_id, "demo-user-mistral");
  assert.equal(log.workspace_id, "demo-workspace-mistral");
})();
