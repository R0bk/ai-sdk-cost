/**
 * Primitive attribute values a telemetry field may contain.
 */
export type TelemetryPrimitive = string | number | boolean | null | undefined;

/**
 * Nested attribute value representation used for headers, metadata, and provider payloads.
 */
export type TelemetryStructuredValue =
  | TelemetryPrimitive
  | TelemetryStructuredValue[]
  | { [key: string]: TelemetryStructuredValue };

export type TelemetryAttributeBag = Record<string, TelemetryStructuredValue | undefined>;

/**
 * Common attributes shared by LLM-oriented spans.
 */
export type BasicLlmSpanAttributes = TelemetryAttributeBag & {
  'operation.name': string;
  'ai.operationId': string;
  'ai.model.id': string;
  'ai.model.provider': string;
  'resource.name'?: string;
  'ai.request.headers'?: Record<string, TelemetryStructuredValue>;
  'ai.response.providerMetadata'?: TelemetryStructuredValue;
  'ai.settings.maxRetries'?: number;
  'ai.telemetry.functionId'?: string;
  'ai.telemetry.metadata'?: Record<string, TelemetryStructuredValue>;
  'ai.usage.completionTokens'?: number;
  'ai.usage.promptTokens'?: number;
};

/**
 * Additional attributes present on spans that correspond to a single provider call.
 */
export type CallLlmSpanAttributes = BasicLlmSpanAttributes & {
  'gen_ai.system': string;
  'gen_ai.request.model': string;
  'gen_ai.usage.input_tokens': number;
  'gen_ai.usage.output_tokens': number;
  'ai.response.model'?: string;
  'ai.response.id'?: string;
  'ai.response.timestamp'?: string | number;
  'gen_ai.request.temperature'?: number;
  'gen_ai.request.max_tokens'?: number;
  'gen_ai.request.frequency_penalty'?: number;
  'gen_ai.request.presence_penalty'?: number;
  'gen_ai.request.top_k'?: number;
  'gen_ai.request.top_p'?: number;
  'gen_ai.request.stop_sequences'?: string[];
  'gen_ai.response.finish_reasons'?: string[];
  'gen_ai.response.model'?: string;
  'gen_ai.response.id'?: string;
};

/**
 * Shared attribute set for embedding-oriented spans.
 */
export type BasicEmbeddingSpanAttributes = TelemetryAttributeBag & {
  'operation.name': string;
  'ai.operationId': string;
  'ai.model.id': string;
  'ai.model.provider': string;
  'resource.name'?: string;
  'ai.request.headers'?: Record<string, TelemetryStructuredValue>;
  'ai.settings.maxRetries'?: number;
  'ai.telemetry.functionId'?: string;
  'ai.telemetry.metadata'?: Record<string, TelemetryStructuredValue>;
  'ai.usage.tokens'?: number;
};

/**
 * Span attribute contract for the logical generateText wrapper span.
 */
export interface GenerateTextSpanAttributes extends BasicLlmSpanAttributes {
  'ai.operationId': 'ai.generateText';
  'ai.prompt'?: string;
  'ai.response.text'?: string;
  'ai.response.toolCalls'?: string;
  'ai.response.finishReason'?: string;
  'ai.settings.maxOutputTokens'?: number;
}

/**
 * Span attribute contract for generateText provider calls.
 */
export interface GenerateTextDoGenerateSpanAttributes extends CallLlmSpanAttributes {
  'ai.operationId': 'ai.generateText.doGenerate';
  'ai.prompt.messages'?: string;
  'ai.prompt.tools'?: string[];
  'ai.prompt.toolChoice'?: string;
  'ai.response.text'?: string;
  'ai.response.toolCalls'?: string;
  'ai.response.finishReason'?: string;
}

/**
 * Span attribute contract for the logical streamText wrapper span.
 */
export interface StreamTextSpanAttributes extends BasicLlmSpanAttributes {
  'ai.operationId': 'ai.streamText';
  'ai.prompt'?: string;
  'ai.response.text'?: string;
  'ai.response.toolCalls'?: string;
  'ai.response.finishReason'?: string;
  'ai.settings.maxOutputTokens'?: number;
}

/**
 * Span attribute contract for streamText provider calls.
 */
export interface StreamTextDoStreamSpanAttributes extends CallLlmSpanAttributes {
  'ai.operationId': 'ai.streamText.doStream';
  'ai.prompt.messages'?: string;
  'ai.prompt.tools'?: string[];
  'ai.prompt.toolChoice'?: string;
  'ai.response.text'?: string;
  'ai.response.toolCalls'?: string;
  'ai.response.msToFirstChunk'?: number;
  'ai.response.msToFinish'?: number;
  'ai.response.avgCompletionTokensPerSecond'?: number;
  'ai.response.finishReason'?: string;
}

/**
 * Span attribute contract for generateObject wrapper span.
 */
export interface GenerateObjectSpanAttributes extends BasicLlmSpanAttributes {
  'ai.operationId': 'ai.generateObject';
  'ai.prompt'?: string;
  'ai.schema'?: string;
  'ai.schema.name'?: string;
  'ai.schema.description'?: string;
  'ai.response.object'?: string;
  'ai.settings.output'?: string;
}

/**
 * Span attribute contract for generateObject provider calls.
 */
export interface GenerateObjectDoGenerateSpanAttributes extends CallLlmSpanAttributes {
  'ai.operationId': 'ai.generateObject.doGenerate';
  'ai.prompt.messages'?: string;
  'ai.response.object'?: string;
  'ai.response.finishReason'?: string;
}

/**
 * Span attribute contract for streamObject wrapper span.
 */
export interface StreamObjectSpanAttributes extends BasicLlmSpanAttributes {
  'ai.operationId': 'ai.streamObject';
  'ai.prompt'?: string;
  'ai.schema'?: string;
  'ai.schema.name'?: string;
  'ai.schema.description'?: string;
  'ai.response.object'?: string;
  'ai.settings.output'?: string;
}

/**
 * Span attribute contract for streamObject provider calls.
 */
export interface StreamObjectDoStreamSpanAttributes extends CallLlmSpanAttributes {
  'ai.operationId': 'ai.streamObject.doStream';
  'ai.prompt.messages'?: string;
  'ai.response.object'?: string;
  'ai.response.msToFirstChunk'?: number;
  'ai.response.finishReason'?: string;
}

/**
 * Span attribute contract for the embed wrapper span.
 */
export interface EmbedSpanAttributes extends BasicEmbeddingSpanAttributes {
  'ai.operationId': 'ai.embed';
  'ai.value'?: TelemetryStructuredValue;
  'ai.embedding'?: string;
}

/**
 * Span attribute contract for embed provider calls.
 */
export interface EmbedDoEmbedSpanAttributes extends BasicEmbeddingSpanAttributes {
  'ai.operationId': 'ai.embed.doEmbed';
  'ai.values'?: TelemetryStructuredValue[];
  'ai.embeddings'?: string[];
}

/**
 * Span attribute contract for the embedMany wrapper span.
 */
export interface EmbedManySpanAttributes extends BasicEmbeddingSpanAttributes {
  'ai.operationId': 'ai.embedMany';
  'ai.values'?: TelemetryStructuredValue[];
  'ai.embeddings'?: string[];
}

/**
 * Span attribute contract for embedMany provider calls.
 */
export interface EmbedManyDoEmbedSpanAttributes extends BasicEmbeddingSpanAttributes {
  'ai.operationId': 'ai.embedMany.doEmbed';
  'ai.values'?: TelemetryStructuredValue[];
  'ai.embeddings'?: string[];
}

/**
 * Span attribute contract for tool call spans.
 */
export type ToolCallSpanAttributes = TelemetryAttributeBag & {
  'operation.name': 'ai.toolCall';
  'ai.operationId': 'ai.toolCall';
  'ai.toolCall.name': string;
  'ai.toolCall.id'?: string;
  'ai.toolCall.args'?: TelemetryStructuredValue;
  'ai.toolCall.result'?: TelemetryStructuredValue;
};

/**
 * Event payload for ai.stream.firstChunk events.
 */
export interface StreamFirstChunkEventAttributes {
  'ai.response.msToFirstChunk': number;
}

/**
 * Event payload for ai.stream.finish events.
 */
export interface StreamFinishEventAttributes {
  'ai.response.finishReason'?: string;
  'ai.response.msToFinish'?: number;
}

/**
 * Convenience unions for span and event groupings.
 */
export interface TelemetrySpanShape<Name extends string, Attrs> {
  name: Name;
  attributes: Attrs;
}

export type GenerateTextTelemetry = TelemetrySpanShape<
  'ai.generateText',
  GenerateTextSpanAttributes
>;
export type GenerateTextDoGenerateTelemetry = TelemetrySpanShape<
  'ai.generateText.doGenerate',
  GenerateTextDoGenerateSpanAttributes
>;
export type StreamTextTelemetry = TelemetrySpanShape<'ai.streamText', StreamTextSpanAttributes>;
export type StreamTextDoStreamTelemetry = TelemetrySpanShape<
  'ai.streamText.doStream',
  StreamTextDoStreamSpanAttributes
>;
export type GenerateObjectTelemetry = TelemetrySpanShape<
  'ai.generateObject',
  GenerateObjectSpanAttributes
>;
export type GenerateObjectDoGenerateTelemetry = TelemetrySpanShape<
  'ai.generateObject.doGenerate',
  GenerateObjectDoGenerateSpanAttributes
>;
export type StreamObjectTelemetry = TelemetrySpanShape<'ai.streamObject', StreamObjectSpanAttributes>;
export type StreamObjectDoStreamTelemetry = TelemetrySpanShape<
  'ai.streamObject.doStream',
  StreamObjectDoStreamSpanAttributes
>;
export type EmbedTelemetry = TelemetrySpanShape<'ai.embed', EmbedSpanAttributes>;
export type EmbedDoEmbedTelemetry = TelemetrySpanShape<'ai.embed.doEmbed', EmbedDoEmbedSpanAttributes>;
export type EmbedManyTelemetry = TelemetrySpanShape<'ai.embedMany', EmbedManySpanAttributes>;
export type EmbedManyDoEmbedTelemetry = TelemetrySpanShape<
  'ai.embedMany.doEmbed',
  EmbedManyDoEmbedSpanAttributes
>;
export type ToolCallTelemetry = TelemetrySpanShape<'ai.toolCall', ToolCallSpanAttributes>;

export interface StreamFirstChunkEvent {
  name: 'ai.stream.firstChunk';
  attributes: StreamFirstChunkEventAttributes;
}

export interface StreamFinishEvent {
  name: 'ai.stream.finish';
  attributes: StreamFinishEventAttributes;
}

export type AiSdkTelemetrySpan =
  | GenerateTextTelemetry
  | GenerateTextDoGenerateTelemetry
  | StreamTextTelemetry
  | StreamTextDoStreamTelemetry
  | GenerateObjectTelemetry
  | GenerateObjectDoGenerateTelemetry
  | StreamObjectTelemetry
  | StreamObjectDoStreamTelemetry
  | EmbedTelemetry
  | EmbedDoEmbedTelemetry
  | EmbedManyTelemetry
  | EmbedManyDoEmbedTelemetry
  | ToolCallTelemetry;

export type AiSdkTelemetryEvent = StreamFirstChunkEvent | StreamFinishEvent;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const hasString = (record: Record<string, unknown>, key: string): boolean =>
  typeof record[key] === 'string';

const hasNumber = (record: Record<string, unknown>, key: string): boolean =>
  typeof record[key] === 'number' && !Number.isNaN(record[key]);

export function isBasicLlmSpanAttributes(value: unknown): value is BasicLlmSpanAttributes {
  if (!isRecord(value)) return false;
  return (
    hasString(value, 'operation.name') &&
    hasString(value, 'ai.operationId') &&
    hasString(value, 'ai.model.id') &&
    hasString(value, 'ai.model.provider')
  );
}

export function isCallLlmSpanAttributes(value: unknown): value is CallLlmSpanAttributes {
  if (!isBasicLlmSpanAttributes(value)) return false;
  return (
    hasString(value, 'gen_ai.system') &&
    hasString(value, 'gen_ai.request.model') &&
    hasNumber(value, 'gen_ai.usage.input_tokens') &&
    hasNumber(value, 'gen_ai.usage.output_tokens')
  );
}

export function isBasicEmbeddingSpanAttributes(value: unknown): value is BasicEmbeddingSpanAttributes {
  if (!isRecord(value)) return false;
  return (
    hasString(value, 'operation.name') &&
    hasString(value, 'ai.operationId') &&
    hasString(value, 'ai.model.id') &&
    hasString(value, 'ai.model.provider')
  );
}

const hasOperation = <T extends BasicLlmSpanAttributes | BasicEmbeddingSpanAttributes>(
  value: unknown,
  operationName: string,
  operationId: string,
  predicate: (candidate: unknown) => candidate is T
): value is T => {
  if (!predicate(value)) return false;
  const record = value as Record<string, unknown>;
  const rawName = record['operation.name'];
  return (
    typeof rawName === 'string' &&
    rawName.startsWith(operationName) &&
    record['ai.operationId'] === operationId
  );
};

export function isGenerateTextSpanAttributes(value: unknown): value is GenerateTextSpanAttributes {
  return hasOperation(value, 'ai.generateText', 'ai.generateText', isBasicLlmSpanAttributes);
}

export function isGenerateTextDoGenerateSpanAttributes(
  value: unknown
): value is GenerateTextDoGenerateSpanAttributes {
  return hasOperation(value, 'ai.generateText.doGenerate', 'ai.generateText.doGenerate', isCallLlmSpanAttributes);
}

export function isStreamTextSpanAttributes(value: unknown): value is StreamTextSpanAttributes {
  return hasOperation(value, 'ai.streamText', 'ai.streamText', isBasicLlmSpanAttributes);
}

export function isStreamTextDoStreamSpanAttributes(
  value: unknown
): value is StreamTextDoStreamSpanAttributes {
  return hasOperation(value, 'ai.streamText.doStream', 'ai.streamText.doStream', isCallLlmSpanAttributes);
}

export function isGenerateObjectSpanAttributes(value: unknown): value is GenerateObjectSpanAttributes {
  return hasOperation(value, 'ai.generateObject', 'ai.generateObject', isBasicLlmSpanAttributes);
}

export function isGenerateObjectDoGenerateSpanAttributes(
  value: unknown
): value is GenerateObjectDoGenerateSpanAttributes {
  return hasOperation(value, 'ai.generateObject.doGenerate', 'ai.generateObject.doGenerate', isCallLlmSpanAttributes);
}

export function isStreamObjectSpanAttributes(value: unknown): value is StreamObjectSpanAttributes {
  return hasOperation(value, 'ai.streamObject', 'ai.streamObject', isBasicLlmSpanAttributes);
}

export function isStreamObjectDoStreamSpanAttributes(
  value: unknown
): value is StreamObjectDoStreamSpanAttributes {
  return hasOperation(value, 'ai.streamObject.doStream', 'ai.streamObject.doStream', isCallLlmSpanAttributes);
}

export function isEmbedSpanAttributes(value: unknown): value is EmbedSpanAttributes {
  return hasOperation(value, 'ai.embed', 'ai.embed', isBasicEmbeddingSpanAttributes);
}

export function isEmbedDoEmbedSpanAttributes(value: unknown): value is EmbedDoEmbedSpanAttributes {
  return hasOperation(value, 'ai.embed.doEmbed', 'ai.embed.doEmbed', isBasicEmbeddingSpanAttributes);
}

export function isEmbedManySpanAttributes(value: unknown): value is EmbedManySpanAttributes {
  return hasOperation(value, 'ai.embedMany', 'ai.embedMany', isBasicEmbeddingSpanAttributes);
}

export function isEmbedManyDoEmbedSpanAttributes(
  value: unknown
): value is EmbedManyDoEmbedSpanAttributes {
  return hasOperation(value, 'ai.embedMany.doEmbed', 'ai.embedMany.doEmbed', isBasicEmbeddingSpanAttributes);
}

export function isToolCallSpanAttributes(value: unknown): value is ToolCallSpanAttributes {
  if (!isRecord(value)) return false;
  return (
    typeof value['operation.name'] === 'string' &&
    (value['operation.name'] as string).startsWith('ai.toolCall') &&
    value['ai.operationId'] === 'ai.toolCall' &&
    hasString(value, 'ai.toolCall.name')
  );
}

export function isStreamFirstChunkEventAttributes(
  value: unknown
): value is StreamFirstChunkEventAttributes {
  if (!isRecord(value)) return false;
  return hasNumber(value, 'ai.response.msToFirstChunk');
}

export function isStreamFinishEventAttributes(value: unknown): value is StreamFinishEventAttributes {
  if (!isRecord(value)) return false;
  const hasFinishReason = value['ai.response.finishReason'] === undefined || hasString(value, 'ai.response.finishReason');
  const hasMs = value['ai.response.msToFinish'] === undefined || hasNumber(value, 'ai.response.msToFinish');
  return hasFinishReason && hasMs;
}
