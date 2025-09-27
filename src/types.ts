export type StandardUsage = {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export type TokenLog = {
  time: string;
  provider?: string | null;
  model: string;
  input: number;
  output: number;
  cache_read: number;
  cache_write: number;
  cost_cents?: number | null;
  finish_reason?: string | null;
  user_id?: string | null;
  workspace_id?: string | null;
  traceId?: string;
  spanId?: string;
  attributes?: Record<string, unknown>;
};

export interface TokenLogSink {
  handle: (log: TokenLog) => void | Promise<void>;
}

export type PriceEntry = {
  model: string;
  prompt_per_1m_usd?: number | null;
  completion_per_1m_usd?: number | null;
  request_usd?: number | null;
  image_usd?: number | null;
  web_search_usd?: number | null;
  internal_reasoning_usd?: number | null;
  input_cache_read_per_1m_usd?: number | null;
  input_cache_write_per_1m_usd?: number | null;
  extras?: Record<string, number | null>;
};

export type PriceMap = Record<string, PriceEntry>;

export type PriceWatcherOptions = {
  intervalMs?: number;
  onUpdate?: (prices: PriceMap) => void;
  fetchFn?: typeof fetch;
};

export type GitHubPublishOptions = {
  owner: string;
  repo: string;
  branch?: string;
  path?: string;
  token: string;
};

export type ModelMapping = Record<string, string>;
