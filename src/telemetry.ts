import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import type { PriceEntry, TokenLog, TokenLogSink } from './types';
import { packagedOpenRouterPricing } from './openrouter';

type Attrs = Record<string, unknown>;

export type ExporterContextResolver = (span: ReadableSpan, attrs: Attrs) => {
  userId?: string | null;
  workspaceId?: string | null;
} | undefined | null;

export type ExporterOptions = {
  getContext?: ExporterContextResolver;
  userIdAttributes?: string[];
  workspaceIdAttributes?: string[];
};

const AI_SPAN_MATCHERS = [
  'ai.generateText.doGenerate',
  'ai.streamText.doStream',
  'ai.generateObject.doGenerate',
  'ai.streamObject.doStream'
];

const DEFAULT_USER_ID_ATTRS = [
  'ai.user.id',
  'ai.userId',
  'gen_ai.user.id',
  'gen_ai.userId',
  'user.id',
  'userId'
];

const DEFAULT_WORKSPACE_ID_ATTRS = [
  'ai.workspace.id',
  'ai.space.id',
  'workspace.id',
  'space.id'
];

function looksLikeAiSdkSpan(span: ReadableSpan): boolean {
  const name = span.name ?? '';
  return AI_SPAN_MATCHERS.some((matcher) => name.includes(matcher));
}

function getAttr(attrs: Attrs, keys: string[]): unknown {
  for (const key of keys) {
    if (key in attrs) return (attrs as Record<string, unknown>)[key];
  }
  return undefined;
}

function parseMaybeJSON(value: unknown): unknown {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object') return value;
  return undefined;
}

type NumberLike = number | string | null | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toFiniteNumber(value: NumberLike): number | undefined {
  if (value === undefined || value === null) return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    if (!(key in record)) continue;
    const candidate = toFiniteNumber(record[key] as NumberLike);
    if (candidate !== undefined) return candidate;
  }
  return undefined;
}

function pickRecord(record: Record<string, unknown>, keys: string[]): Record<string, unknown> | undefined {
  for (const key of keys) {
    if (!(key in record)) continue;
    const candidate = record[key];
    if (isRecord(candidate)) return candidate;
  }
  return undefined;
}

function lookupPrice(provider: string | null | undefined, model: string): PriceEntry | null {
  const entries = packagedOpenRouterPricing;
  const normalizedModel = model.toLowerCase();
  const providerFragment = provider ? provider.toLowerCase().split(/[^a-z0-9]+/)[0] : '';

  const keysToTry = new Set<string>();
  keysToTry.add(normalizedModel);
  if (providerFragment) {
    keysToTry.add(`${providerFragment}/${normalizedModel}`);
    keysToTry.add(`${providerFragment}:${normalizedModel}`);
    keysToTry.add(`${providerFragment}-${normalizedModel}`);
  }

  for (const key of keysToTry) {
    const entry = entries[key];
    if (entry) return entry;
  }

  return null;
}

function resolveContext(
  span: ReadableSpan,
  attrs: Attrs,
  options: ExporterOptions
): { userId?: string | null; workspaceId?: string | null } {
  const directContext = options.getContext?.(span, attrs);
  if (directContext) {
    return {
      userId: directContext.userId ?? null,
      workspaceId: directContext.workspaceId ?? null
    };
  }

  const userAttrKeys = options.userIdAttributes ?? DEFAULT_USER_ID_ATTRS;
  const workspaceAttrKeys = options.workspaceIdAttributes ?? DEFAULT_WORKSPACE_ID_ATTRS;

  const userId = (getAttr(attrs, userAttrKeys) ?? null) as string | null;
  const workspaceId = (getAttr(attrs, workspaceAttrKeys) ?? null) as string | null;

  return { userId, workspaceId };
}

function computeCostFromUsage(
  usage: { input: number; output: number; cache_read: number; cache_write: number },
  price: PriceEntry | null
): { costCents: number | null } {
  if (!price) return { costCents: null };

  const inputPrice = price.prompt_per_1m_usd ?? 0;
  const outputPrice = price.completion_per_1m_usd ?? 0;
  const cacheReadPrice = price.input_cache_read_per_1m_usd ?? 0;
  const cacheWritePrice = price.input_cache_write_per_1m_usd ?? 0;
  const requestPrice = price.request_usd ?? 0;

  const costUsdRaw =
    usage.input * inputPrice +
    usage.output * outputPrice +
    usage.cache_read * cacheReadPrice +
    usage.cache_write * cacheWritePrice +
    requestPrice;
  const costUsd = Number(costUsdRaw.toFixed(12));
  const costCents = Number((costUsd * 100).toFixed(6));
  return { costCents };
}

function extractCacheTokens(attrs: Attrs): { cacheRead: number; cacheWrite: number } {
  const readValues = new Map<string, number>();
  const writeValues = new Map<string, number>();

  const setMax = (map: Map<string, number>, key: string, value: NumberLike) => {
    const num = toFiniteNumber(value);
    if (num === undefined) return;
    const current = map.get(key);
    if (current === undefined || num > current) {
      map.set(key, num);
    }
  };

  const attrCacheIn = getAttr(attrs, [
    'ai.usage.cachedInputTokens',
    'ai.usage.cachedTokens',
    'gen_ai.usage.cached_input_tokens',
    'gen_ai.usage.cached_tokens'
  ]);
  setMax(readValues, 'input', attrCacheIn as NumberLike);

  const attrCacheOut = getAttr(attrs, [
    'ai.usage.cachedOutputTokens',
    'gen_ai.usage.cached_output_tokens'
  ]);
  setMax(readValues, 'output', attrCacheOut as NumberLike);

  const providerMeta = parseMaybeJSON(
    getAttr(attrs, ['ai.response.providerMetadata', 'gen_ai.response.provider_metadata'])
  );

  const usageCandidates: Record<string, unknown>[] = [];
  const telemetryUsage = parseMaybeJSON(getAttr(attrs, ['ai.usage.details']));
  if (isRecord(telemetryUsage)) usageCandidates.push(telemetryUsage);

  if (isRecord(providerMeta)) {
    const directUsage = providerMeta.usage;
    if (isRecord(directUsage)) usageCandidates.push(directUsage);

    const responseUsage = isRecord(providerMeta.response) ? providerMeta.response.usage : undefined;
    if (isRecord(responseUsage)) usageCandidates.push(responseUsage);

    for (const value of Object.values(providerMeta)) {
      if (!isRecord(value)) continue;
      if (isRecord(value.usage)) usageCandidates.push(value.usage);
      if (isRecord(value.response) && isRecord(value.response.usage)) {
        usageCandidates.push(value.response.usage);
      }
    }
  }

  const processUsage = (usage: Record<string, unknown>) => {
    const promptDetails = pickRecord(usage, ['prompt_tokens_details', 'promptTokensDetails']);
    const cachedFromDetails = promptDetails
      ? pickNumber(promptDetails, ['cached_tokens', 'cachedTokens'])
      : undefined;
    const cacheCreationFromDetails = promptDetails
      ? pickNumber(promptDetails, ['cache_creation_input_tokens', 'cacheCreationInputTokens'])
      : undefined;

    const cacheReadInput = pickNumber(usage, ['cache_read_input_tokens', 'cacheReadInputTokens']);
    if (cacheReadInput !== undefined) {
      setMax(readValues, 'input', cacheReadInput);
    } else if (cachedFromDetails !== undefined) {
      setMax(readValues, 'input', cachedFromDetails);
    }

    const cacheReadOutput = pickNumber(usage, ['cache_read_output_tokens', 'cacheReadOutputTokens']);
    if (cacheReadOutput !== undefined) {
      setMax(readValues, 'output', cacheReadOutput);
    }

    const cacheWriteInput = pickNumber(usage, ['cache_creation_input_tokens', 'cacheCreationInputTokens']);
    if (cacheWriteInput !== undefined) {
      setMax(writeValues, 'write_input', cacheWriteInput);
    } else if (cacheCreationFromDetails !== undefined) {
      setMax(writeValues, 'write_input', cacheCreationFromDetails);
    }

    const cacheWriteOutput = pickNumber(usage, ['cache_creation_output_tokens', 'cacheCreationOutputTokens']);
    if (cacheWriteOutput !== undefined) {
      setMax(writeValues, 'write_output', cacheWriteOutput);
    }
  };

  for (const candidate of usageCandidates) {
    processUsage(candidate);
  }

  const cacheRead = Array.from(readValues.entries()).reduce((sum, [key, value]) => {
    if (key.startsWith('write_')) return sum;
    return sum + value;
  }, 0);

  const cacheWrite = Array.from(writeValues.values()).reduce((sum, value) => sum + value, 0);

  return { cacheRead, cacheWrite };
}

function computeTimestamp(span: ReadableSpan): string {
  const [seconds, nanos] = span.endTime;
  const millis = seconds * 1000 + Math.round(nanos / 1e6);
  return new Date(millis).toISOString();
}

function toNumber(value: unknown): number {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export class AiSdkTokenExporter implements SpanExporter {
  constructor(
    private readonly sink: TokenLogSink,
    private readonly options: ExporterOptions = {}
  ) {}

  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    (async () => {
      for (const span of spans) {
        try {
          if (!looksLikeAiSdkSpan(span)) continue;
          const attrs = (span.attributes ?? {}) as Attrs;

          const model =
            (getAttr(attrs, [
              'gen_ai.request.model',
              'gen_ai.response.model',
              'ai.model.id',
              'ai.response.model'
            ]) as string | undefined) ?? 'unknown';

          const provider = getAttr(attrs, ['gen_ai.system', 'ai.model.provider']);

          const inputTokens = toNumber(
            getAttr(attrs, ['gen_ai.usage.input_tokens', 'ai.usage.promptTokens', 'ai.usage.inputTokens'])
          );
          const outputTokens = toNumber(
            getAttr(attrs, ['gen_ai.usage.output_tokens', 'ai.usage.completionTokens', 'ai.usage.outputTokens'])
          );

          const { cacheRead, cacheWrite } = extractCacheTokens(attrs);
          const price = lookupPrice(provider ? String(provider) : null, String(model));
          const { costCents } = computeCostFromUsage(
            { input: inputTokens, output: outputTokens, cache_read: cacheRead, cache_write: cacheWrite },
            price
          );
          const finishReason = getAttr(attrs, ['ai.response.finishReason', 'gen_ai.response.finish_reasons']);
          const context = resolveContext(span, attrs, this.options);

          const log: TokenLog = {
            time: computeTimestamp(span),
            provider: provider ? String(provider) : null,
            model: String(model),
            input: inputTokens,
            output: outputTokens,
            cache_read: cacheRead,
            cache_write: cacheWrite,
            cost_cents: costCents,
            finish_reason:
              Array.isArray(finishReason)
                ? String(finishReason[0])
                : finishReason != null
                  ? String(finishReason)
                  : null,
            user_id: context.userId ?? null,
            workspace_id: context.workspaceId ?? null,
            traceId: span.spanContext().traceId,
            spanId: span.spanContext().spanId,
            attributes: attrs
          };

          await this.sink.handle(log);
        } catch {
          // Intentionally swallow errors so telemetry export never crashes the tracer.
        }
      }
      resultCallback({ code: ExportResultCode.SUCCESS });
    })();
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}
