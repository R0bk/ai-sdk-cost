import { context } from '@opentelemetry/api';
import { SpanExporter, ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { ExportResult, ExportResultCode } from '@opentelemetry/core';
import type { PriceEntry, TokenLog, TokenLogSink, ModelMapping } from './types';
import { packagedOpenRouterPricing } from './openrouter';
import { normalizeProviderTokens } from './providers';
import { isCallLlmSpanAttributes, isStreamFinishEventAttributes, TelemetryAttributeBag } from './telemetry-types';

export type Attrs = TelemetryAttributeBag;

export type ExporterContextResolver = (span: ReadableSpan, attrs: Attrs) => {
  userId?: string | null;
  workspaceId?: string | null;
} | undefined | null;

export type ExporterOptions = {
  getContext?: ExporterContextResolver;
  userIdAttributes?: string[];
  workspaceIdAttributes?: string[];
  modelMapping?: ModelMapping;
  includeAttributes?: boolean;
};

const AI_SPAN_MATCHERS = [
  'ai.generateText.doGenerate',
  'ai.streamText.doStream',
  'ai.generateObject.doGenerate',
  'ai.streamObject.doStream'
];

const DEFAULT_USER_ID_ATTRS = ['ai.telemetry.metadata.userId', 'ai.telemetry.metadata.user_id'];

const DEFAULT_WORKSPACE_ID_ATTRS = ['ai.telemetry.metadata.workspaceId', 'ai.telemetry.metadata.workspace_id'];

export const USER_CONTEXT_KEY = Symbol('ai-sdk-cost-user');
export const WORKSPACE_CONTEXT_KEY = Symbol('ai-sdk-cost-workspace');

function looksLikeAiSdkSpan(span: ReadableSpan): boolean {
  const name = span.name ?? '';
  return AI_SPAN_MATCHERS.some((matcher) => name.includes(matcher));
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
  const userAttrKeys = options.userIdAttributes ?? DEFAULT_USER_ID_ATTRS;
  const workspaceAttrKeys = options.workspaceIdAttributes ?? DEFAULT_WORKSPACE_ID_ATTRS;

  // Priority order:
  // 1. Per-call attributes (from metadata)
  // 2. Global context from getContext callback
  // 3. OpenTelemetry context values

  // Check attributes first
  let userId = userAttrKeys.map(key => attrs[key]).find(key => key !== undefined) as string | null | undefined;
  let workspaceId = workspaceAttrKeys.map(key => attrs[key]).find(key => key !== undefined) as string | null | undefined;

  // If not found in attributes, try getContext callback
  const direct = options.getContext?.(span, attrs) ?? undefined;
  if (userId == null && direct?.userId != null) {
    userId = direct.userId;
  }
  if (workspaceId == null && direct?.workspaceId != null) {
    workspaceId = direct.workspaceId;
  }

  // Finally, check OpenTelemetry context
  if (userId == null) {
    const ctxUser = context.active().getValue(USER_CONTEXT_KEY) as string | null | undefined;
    if (ctxUser != null) userId = ctxUser;
  }
  if (workspaceId == null) {
    const ctxWorkspace = context.active().getValue(WORKSPACE_CONTEXT_KEY) as string | null | undefined;
    if (ctxWorkspace != null) workspaceId = ctxWorkspace;
  }

  return { userId: userId ?? null, workspaceId: workspaceId ?? null };
}

function computeCostFromUsage(
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number },
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
    usage.cacheRead * cacheReadPrice +
    usage.cacheWrite * cacheWritePrice +
    requestPrice;
  const costUsd = Number(costUsdRaw.toFixed(12));
  const costCents = Number((costUsd * 100).toFixed(6));
  return { costCents };
}

function computeTimestamp(span: ReadableSpan): string {
  const [seconds, nanos] = span.endTime;
  const millis = seconds * 1000 + Math.round(nanos / 1e6);
  return new Date(millis).toISOString();
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
          const attrs = (span.attributes ?? {}) as unknown;
          if (!isCallLlmSpanAttributes(attrs)) continue;

          const modelOverride = attrs['ai.telemetry.metadata.modelName'];

          const responseModel = attrs['ai.response.model'];
          const requestedModel = attrs['gen_ai.request.model'];
          const baseModel = attrs['ai.model.id'];

          // Layered model resolution: per-call override → response alias → model.id → request target.
          const modelCandidates = [modelOverride, responseModel, baseModel, requestedModel];
          const primaryModel = modelCandidates.find((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0) ?? 'unknown';
          const model = this.options.modelMapping?.[primaryModel] ?? primaryModel;

          const provider = attrs['ai.model.provider'];

          const inputTokens = attrs['gen_ai.usage.input_tokens'];
          const outputTokens = attrs['gen_ai.usage.output_tokens'];
          const cacheReadTokens = attrs['gen_ai.usage.cachedInputTokens'] as number | undefined ?? 0;

          // const { cacheRead } = extractCacheTokens(attrs);

          // Provider fixes unify token accounting before cost math.
          const normalizedTokens = normalizeProviderTokens(provider, attrs, {
            input: inputTokens,
            output: outputTokens,
            cacheRead: cacheReadTokens,
            cacheWrite: 0
          });

          const price = lookupPrice(provider, model);
          const { costCents } = computeCostFromUsage(normalizedTokens, price);

          // Capture finish reason with GenAI semantics fallback.
          const finishReason = isStreamFinishEventAttributes(attrs)
            ? attrs['ai.response.finishReason'] ?? attrs['gen_ai.response.finish_reasons']?.[0]
            : undefined;

          const context = resolveContext(span, attrs, this.options);

          const log: TokenLog = {
            time: computeTimestamp(span),
            provider,
            model,
            input: normalizedTokens.input,
            output: normalizedTokens.output,
            cache_read: normalizedTokens.cacheRead,
            cache_write: normalizedTokens.cacheWrite,
            cost_cents: costCents,
            finish_reason: finishReason,
            user_id: context.userId ?? null,
            workspace_id: context.workspaceId ?? null,
            traceId: span.spanContext().traceId,
            spanId: span.spanContext().spanId
          };

          // Only include attributes if explicitly requested (for debugging)
          if (this.options.includeAttributes) log.attributes = attrs;

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
