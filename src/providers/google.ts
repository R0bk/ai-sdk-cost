export interface GoogleUsageMetadata {
  thoughtsTokenCount?: number;
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  cachedContentTokenCount?: number;
}

export interface GoogleProviderUsage {
  google?: {
    usageMetadata?: GoogleUsageMetadata | null;
  } & Record<string, unknown>;
}
