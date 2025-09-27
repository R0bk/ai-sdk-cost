import { z } from 'zod/v4';
import { anthropicMetadataSchema } from './anthropic';
import { googleMetadataSchema } from './google';
import { openaiMetadataSchema } from './openai';
import { CallLlmSpanAttributes, TelemetryStructuredValue } from '../telemetry-types';
import { NumberLike, StandardUsage } from '../types';
export * from './anthropic';
export * from './google';
export * from './openai';

const toFiniteAttrNumber = (value: TelemetryStructuredValue | undefined): number | undefined => {
  return typeof value === 'number' || typeof value === 'string' ? toFiniteNumber(value) : undefined;
};

const toFiniteNumber = (value: NumberLike): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}


const providerMetadataSchema = z.looseObject({
  ...anthropicMetadataSchema.shape,
  ...openaiMetadataSchema.shape,
  ...googleMetadataSchema.shape
});

export type ProviderMetadata = z.infer<typeof providerMetadataSchema>;

const providerMetadataInputSchema = z.preprocess((value) => {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}, providerMetadataSchema.optional());

const parseProviderMetadata = (value: unknown): ProviderMetadata | null => {
  const result = providerMetadataInputSchema.safeParse(value);
  return result.success ? result.data ?? null : null;
};

/**
 * Provider-specific token normalization to handle inconsistencies
 * between SDK usage and provider metadata reporting
 *
 * Goal: Normalize to consistent token reporting:
 * - input: NEW tokens only (not including cached)
 * - output: Generated tokens (including reasoning if present)
 * - cache_read: Reused cached tokens
 * - cache_write: New tokens written to cache
 */
export function normalizeProviderTokens(
  provider: string | null,
  attrs: CallLlmSpanAttributes,
  sdkTokens: StandardUsage
): StandardUsage {
  if (!provider) return sdkTokens;

  const providerLower = provider.toLowerCase();
  const providerMetadata = parseProviderMetadata(attrs['ai.response.providerMetadata']);
  if (!providerMetadata) return sdkTokens;

  // Anthropic-specific fixes
  if (providerLower.includes('anthropic')) {
    const anthropicMetadata = providerMetadata.anthropic;
    const anthropicUsage = anthropicMetadata?.usage;
    if (anthropicUsage) {
      // Provider metadata reports incorrect output_tokens; prefer SDK output.
      const cacheReadTokens = toFiniteNumber(anthropicUsage.cache_read_input_tokens);
      const cacheWriteTokens =
        toFiniteNumber(anthropicUsage.cache_creation_input_tokens) ??
        toFiniteNumber(anthropicMetadata?.cacheCreationInputTokens);

      return {
        input: sdkTokens.input,
        output: sdkTokens.output,
        cacheRead: cacheReadTokens ?? sdkTokens.cacheRead,
        cacheWrite: cacheWriteTokens ?? 0
      };
    }
  }
  
  
  // OpenAI-specific handling
  if (providerLower.includes('openai')) {
    const openaiMetadata = providerMetadata.openai;
    const cachedTokens =
      toFiniteNumber(openaiMetadata?.usage?.cached_input_tokens) ??
      toFiniteAttrNumber(attrs['ai.usage.cachedInputTokens']);

    // OpenAI reports cached tokens inside input_tokens; subtract the reused portion.
    const actualInput = Math.max(0, sdkTokens.input - (cachedTokens ?? 0));

    return {
      input: actualInput,
      output: sdkTokens.output,
      cacheRead: cachedTokens ?? sdkTokens.cacheRead,
      cacheWrite: 0 // OpenAI doesn't report cache write tokens
    };
  }
  
  
  // Google/Gemini-specific handling
  if (providerLower.includes('google') || providerLower.includes('gemini')) {
    const googleMetadata = providerMetadata.google;
    const cacheReadTokens =
      toFiniteNumber(googleMetadata?.usageMetadata?.cachedContentTokenCount) ??
      toFiniteAttrNumber(attrs['ai.usage.cachedInputTokens']);

    // Gemini reports cached tokens in promptTokenCount; separate them from new input.
    const actualInput = Math.max(0, sdkTokens.input - (cacheReadTokens ?? 0));

    return {
      input: actualInput,
      output: sdkTokens.output,
      cacheRead: cacheReadTokens ?? sdkTokens.cacheRead,
      cacheWrite: 0 // Google doesn't report cache write tokens
    };
  }

  return sdkTokens;
}
