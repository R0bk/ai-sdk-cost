import { Buffer } from 'node:buffer';
import { z } from 'zod';
import pricePackagedRaw from './data/openrouter-pricing.json';
import type { GitHubPublishOptions, PriceEntry, PriceMap, PriceWatcherOptions } from './types';

const numericLike = z.union([z.number(), z.string()]);

const OpenRouterModel = z.object({
  id: z.string(),
  canonical_slug: z.string().optional(),
  pricing: z
    .object({
      prompt: numericLike.optional(),
      completion: numericLike.optional(),
      request: numericLike.optional(),
      image: numericLike.optional(),
      web_search: numericLike.optional(),
      internal_reasoning: numericLike.optional(),
      input_cache_read: numericLike.optional(),
      input_cache_write: numericLike.optional()
    })
    .passthrough()
    .optional()
});

const OpenRouterPayload = z.object({
  data: z.array(OpenRouterModel)
});

const PriceEntrySchema = z.object({
  model: z.string(),
  prompt_per_1m_usd: z.number().nullable().optional(),
  completion_per_1m_usd: z.number().nullable().optional(),
  request_usd: z.number().nullable().optional(),
  image_usd: z.number().nullable().optional(),
  web_search_usd: z.number().nullable().optional(),
  internal_reasoning_usd: z.number().nullable().optional(),
  input_cache_read_per_1m_usd: z.number().nullable().optional(),
  input_cache_write_per_1m_usd: z.number().nullable().optional(),
  extras: z.record(z.number().nullable()).optional()
});

const PackagedPricingSchema = z.record(PriceEntrySchema);

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export const packagedOpenRouterPricing: PriceMap = Object.fromEntries(
  Object.entries(PackagedPricingSchema.parse(pricePackagedRaw)).map(([key, value]) => [
    key.toLowerCase(),
    value
  ])
);

export function getPackagedOpenRouterPricing(): PriceMap {
  return JSON.parse(JSON.stringify(packagedOpenRouterPricing)) as PriceMap;
}

export async function fetchOpenRouterPricing(fetchFn: typeof fetch = fetch): Promise<PriceMap> {
  const response = await fetchFn('https://openrouter.ai/api/v1/models', {
    headers: { accept: 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`OpenRouter models fetch failed: ${response.status}`);
  }

  const json = await response.json();
  const parsed = OpenRouterPayload.safeParse(json);
  if (!parsed.success) {
    throw new Error('Unexpected schema from OpenRouter models endpoint');
  }

  const prices: PriceMap = {};
  for (const model of parsed.data.data) {
    if (!/^(x-ai|openai|anthropic|google|deepseek)/i.test(model.id)) continue;
    const pricing = (model.pricing ?? {}) as Record<string, unknown>;
    const entry: PriceEntry = {
      model: model.id,
      prompt_per_1m_usd: toNumberOrNull(pricing.prompt),
      completion_per_1m_usd: toNumberOrNull(pricing.completion),
      request_usd: toNumberOrNull(pricing.request),
      image_usd: toNumberOrNull(pricing.image),
      web_search_usd: toNumberOrNull(pricing.web_search),
      internal_reasoning_usd: toNumberOrNull(pricing.internal_reasoning),
      input_cache_read_per_1m_usd: toNumberOrNull(pricing.input_cache_read),
      input_cache_write_per_1m_usd: toNumberOrNull(pricing.input_cache_write)
    };

    const knownKeys = new Set([
      'prompt',
      'completion',
      'request',
      'image',
      'web_search',
      'internal_reasoning',
      'input_cache_read',
      'input_cache_write'
    ]);

    const extras: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(pricing)) {
      if (knownKeys.has(key)) continue;
      const numeric = toNumberOrNull(value);
      if (numeric !== null) {
        extras[key] = numeric;
      }
    }

    if (Object.keys(extras).length > 0) {
      entry.extras = extras;
    }

    const primaryKey = model.id.toLowerCase();
    prices[primaryKey] = entry;

    if (model.canonical_slug) {
      prices[model.canonical_slug.toLowerCase()] = entry;
    }

    const shortKey = primaryKey.includes('/') ? primaryKey.split('/').pop() : undefined;
    if (shortKey) {
      prices[shortKey] = entry;
    }
  }

  return prices;
}

export function diffPriceMaps(a: PriceMap, b: PriceMap): boolean {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();

  if (keysA.length !== keysB.length) return true;
  for (let i = 0; i < keysA.length; i += 1) {
    if (keysA[i] !== keysB[i]) return true;
    const valueA = a[keysA[i]];
    const valueB = b[keysB[i]];
    if (JSON.stringify(valueA) !== JSON.stringify(valueB)) return true;
  }
  return false;
}

export function startOpenRouterPriceWatcher(options: PriceWatcherOptions = {}) {
  const intervalMs = options.intervalMs ?? 6 * 60 * 60 * 1000;
  let current: PriceMap | null = options.onUpdate ? getPackagedOpenRouterPricing() : null;

  const tick = async () => {
    try {
      const next = await fetchOpenRouterPricing(options.fetchFn ?? fetch);
      if (!current || diffPriceMaps(current, next)) {
        current = next;
        options.onUpdate?.(next);
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[openrouter-price-watcher] error', error);
    }
  };

  void tick();
  const timer = setInterval(tick, intervalMs);
  return () => clearInterval(timer);
}

export async function publishPricesToGitHub(prices: PriceMap, options: GitHubPublishOptions) {
  const { owner, repo, token } = options;
  const branch = options.branch ?? 'main';
  const path = options.path ?? 'data/openrouter-pricing.json';

  const baseUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'user-agent': 'ai-sdk-cost'
  };

  let sha: string | undefined;
  const readResponse = await fetch(`${baseUrl}?ref=${encodeURIComponent(branch)}`, { headers });
  if (readResponse.ok) {
    const body = await readResponse.json();
    if (body && typeof body.sha === 'string') sha = body.sha;
  }

  const content = Buffer.from(JSON.stringify(prices, null, 2), 'utf8').toString('base64');
  const body = {
    message: `chore: update OpenRouter pricing (${new Date().toISOString()})`,
    content,
    branch,
    sha
  };

  const writeResponse = await fetch(baseUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify(body)
  });

  if (!writeResponse.ok) {
    const errorText = await writeResponse.text();
    throw new Error(`GitHub publish failed: ${writeResponse.status} ${errorText}`);
  }
}
