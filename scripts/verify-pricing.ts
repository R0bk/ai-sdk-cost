import { packagedOpenRouterPricing } from '../src/openrouter';

const pricing = packagedOpenRouterPricing;
const entries = Object.keys(pricing);

if (entries.length === 0) {
  throw new Error('Pricing snapshot is empty. Run "pnpm run fetch:prices" before executing this script.');
}

const requiredModels = [
  'openai/gpt-5-nano',
  'anthropic/claude-3-5-haiku-20241022'
];

const missing = requiredModels.filter((id) => !pricing[id.toLowerCase()]);
if (missing.length) {
  throw new Error(`Missing required pricing entries: ${missing.join(', ')}. Refresh snapshot with "pnpm run fetch:prices".`);
}

function computeCostCents(usage: { input: number; output: number; cache: number }, modelId: string) {
  const price = pricing[modelId.toLowerCase()];
  if (!price) throw new Error(`Price not found for ${modelId}`);
  const prompt = price.prompt_per_1m_usd ?? 0;
  const completion = price.completion_per_1m_usd ?? 0;
  const cache = price.input_cache_read_per_1m_usd ?? 0;
  const cacheWrite = price.input_cache_write_per_1m_usd ?? 0;
  const request = price.request_usd ?? 0;
  const costUsd =
    usage.input * prompt +
    usage.output * completion +
    usage.cache * cache +
    usage.cache * cacheWrite +
    request;
  return Number((costUsd * 100).toFixed(6));
}

computeCostCents({ input: 0.0002, output: 0.00015, cache: 0 }, 'openai/gpt-5-nano');
computeCostCents({ input: 0.00005, output: 0.0002, cache: 0.0001 }, 'anthropic/claude-3-5-haiku-20241022');

console.log('Pricing snapshot sanity checks passed.');
