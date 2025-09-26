import { toFiniteNumber } from "../parser";
import { StandardUsage } from "../types";

export interface AnthropicCacheCreationBreakdown {
  ephemeral_5m_input_tokens?: number;
  ephemeral_1h_input_tokens?: number;
}

export interface AnthropicUsageRecord {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: AnthropicCacheCreationBreakdown | null;
  service_tier?: string;
}

export interface AnthropicProviderUsage {
  anthropic?: {
    usage?: AnthropicUsageRecord;
    cacheCreationInputTokens?: number | null;
  } & Record<string, unknown>;
}
