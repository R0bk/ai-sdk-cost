import { consoleSink } from './sinks';
import type { TokenLogSink, ModelMapping } from './types';
import { AiSdkTokenExporter, type ExporterOptions, type ExporterContextResolver } from './telemetry';
import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import type { Tracer } from '@opentelemetry/api';

export type TelemetryInitOptions = {
  /** Custom sink for log delivery (defaults to consoleSink). */
  sink?: TokenLogSink;
  /** Provide a pre-configured exporter if you need full control. */
  exporter?: AiSdkTokenExporter;
  /** Override user id attribute lookup. */
  userIdAttributes?: string[];
  /** Override workspace id attribute lookup. */
  workspaceIdAttributes?: string[];
  /** Custom context resolver hook. */
  getContext?: ExporterContextResolver;
  /** Map deployment/proxy names to actual model names for accurate pricing. */
  modelMapping?: ModelMapping;
  /** Include full telemetry attributes in logs (default false, use true for debugging). */
  includeAttributes?: boolean;
  /** Supply your own span processor (defaults to BatchSpanProcessor). */
  spanProcessor?: SpanProcessor;
  /**
   * Reuse an existing tracer provider.
   * Note: In OpenTelemetry v2, you must configure the provider with AiSdkTokenExporter yourself.
   * This option is for advanced users who need unified tracing across multiple libraries.
   */
  tracerProvider?: NodeTracerProvider;
  /** Automatically register the provider globally (default true). */
  autoRegister?: boolean;
  /** Name for the tracer returned (default "ai-sdk-cost"). */
  tracerName?: string;
};

export type TelemetryInitResult = {
  tracerProvider: NodeTracerProvider;
  tracer: Tracer;
  exporter: AiSdkTokenExporter;
  spanProcessor: SpanProcessor;
};

const DEFAULT_USER_ATTRS = [
  'ai.telemetry.metadata.userId',
  'app.user.id',
  'user.id'
];
const DEFAULT_WORKSPACE_ATTRS = [
  'ai.telemetry.metadata.workspaceId',
  'app.workspace.id',
  'workspace.id'
];

function buildExporterOptions(options: TelemetryInitOptions): ExporterOptions {
  return {
    userIdAttributes: options.userIdAttributes ?? DEFAULT_USER_ATTRS,
    workspaceIdAttributes: options.workspaceIdAttributes ?? DEFAULT_WORKSPACE_ATTRS,
    getContext: options.getContext,
    modelMapping: options.modelMapping,
    includeAttributes: options.includeAttributes
  };
}

export function initAiSdkCostTelemetry(options: TelemetryInitOptions = {}): TelemetryInitResult {
  const exporter =
    options.exporter ??
    new AiSdkTokenExporter(options.sink ?? consoleSink(), buildExporterOptions(options));

  const spanProcessor = options.spanProcessor ?? new BatchSpanProcessor(exporter);

  let tracerProvider = options.tracerProvider;
  let createdOurOwnProvider = false;

  if (!tracerProvider) {
    // Create a new provider with our exporter
    tracerProvider = new NodeTracerProvider({
      spanProcessors: [spanProcessor]
    });
    createdOurOwnProvider = true;
  }
  // Note: If user passed their own provider, they must have already configured it
  // with our exporter. We can't add processors to existing providers in v2.

  if (options.autoRegister !== false && createdOurOwnProvider) {
    tracerProvider.register();
  }

  const tracer = tracerProvider.getTracer(options.tracerName ?? 'ai-sdk-cost');

  return { tracerProvider, tracer, exporter, spanProcessor };
}
