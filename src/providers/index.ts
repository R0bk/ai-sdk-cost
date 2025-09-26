import { toFiniteNumber, toNumber, parseMaybeJSON } from '../parser';
import type { AnthropicProviderUsage } from './anthropic';
import type { GoogleProviderUsage } from './google';
import type { OpenAIProviderUsage } from './openai';
import { CallLlmSpanAttributes } from '../telemetry-types';
import { StandardUsage } from '../types';
export * from './anthropic';
export * from './google';
export * from './openai';

export type ProviderUsage = AnthropicProviderUsage | GoogleProviderUsage | OpenAIProviderUsage;

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
  const providerMetadataRaw = parseMaybeJSON(attrs['ai.response.providerMetadata']) as ProviderUsage | null | undefined;
  if (providerMetadataRaw === undefined && providerMetadataRaw === null) return sdkTokens

  // Anthropic-specific fixes
  if (providerLower.includes('anthropic')) {
    const anthropicMeta = (providerMetadataRaw as AnthropicProviderUsage)?.anthropic;
    if (anthropicMeta !== undefined && anthropicMeta !== null) {
      const anthropicUsage = anthropicMeta.usage;
      if (anthropicUsage !== undefined && anthropicUsage !== null) {
        // Bug fixes:
        // 1. Provider metadata reports incorrect output_tokens (usually 1-2)
        // 2. SDK totalTokens doesn't include cache_write/cache_read
        const cacheReadTokens = toFiniteNumber(anthropicUsage.cache_read_input_tokens) ?? 0;
        const cacheWriteTokens = toFiniteNumber(anthropicUsage.cache_creation_input_tokens) ?? 0;

        return {
          input: sdkTokens.input,
          output: sdkTokens.output, // Use SDK value, not provider metadata
          cacheRead: cacheReadTokens || sdkTokens.cacheRead,
          cacheWrite: cacheWriteTokens || sdkTokens.cacheWrite
        };
      }
    }
  }


  // OpenAI-specific handling
  if (providerLower.includes('openai')) {
    const openaiMeta = (providerMetadataRaw as OpenAIProviderUsage)?.openai;
    // OpenAI reports input_tokens = actual_input + cache_read
    // We need to separate input from cache_read

    const cachedTokens = toNumber(attrs['ai.usage.cachedInputTokens']);

    // Separate input from cache_read (OpenAI includes both in input_tokens)
    const actualInput = sdkTokens.input - (cachedTokens || 0);

    return {
      input: Math.max(0, actualInput),
      output: sdkTokens.output, // Keep output as-is (includes reasoning)
      cacheRead: cachedTokens || sdkTokens.cacheRead,
      cacheWrite: sdkTokens.cacheWrite
    };
  }


  // Google/Gemini-specific handling
  if (providerLower.includes('google') || providerLower.includes('gemini')) {
    const googleMeta = (providerMetadataRaw as GoogleProviderUsage)?.google;
    // Gemini reports promptTokenCount = actual_input + cache_read
    let cacheReadTokens = 0;

    const usageMetadata = googleMeta?.usageMetadata;
    if (usageMetadata !== undefined && usageMetadata !== null) {
      cacheReadTokens = toFiniteNumber(usageMetadata.cachedContentTokenCount) ?? 0;
    }

    // Also check standard attributes
    if (!cacheReadTokens) {
      cacheReadTokens = toNumber(attrs['ai.usage.cachedInputTokens']);
    }

    // Separate input from cache_read (Gemini includes both in promptTokenCount)
    const actualInput = sdkTokens.input - (cacheReadTokens || 0);

    return {
      input: Math.max(0, actualInput),
      output: sdkTokens.output, // Keep output as-is
      cacheRead: cacheReadTokens || sdkTokens.cacheRead,
      cacheWrite: 0 // Gemini uses implicit caching, no explicit cache writes
    };
  }

  return sdkTokens;
}
