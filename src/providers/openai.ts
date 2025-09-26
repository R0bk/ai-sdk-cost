export interface OpenAIUsageRecord {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  cached_input_tokens?: number;
}

export interface OpenAIProviderUsage {
  openai?: {
    responseId?: string;
    serviceTier?: string;
    usage?: OpenAIUsageRecord;
  } & Record<string, unknown>;
}
