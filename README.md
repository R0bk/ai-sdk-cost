# ai-sdk-cost

Track every token, calculate every dollar - across workspaces and users - in 3 lines of code.

`ai-sdk-cost` gives you production-ready cost tracking for Vercel AI SDK:
- [x] **Real-time cost per request** - Know exactly what each API call costs
- [x] **User & workspace attribution** - Track costs by customer, team, or feature
- [x] **Multi-provider support** - OpenAI, Anthropic, Google, DeepSeek, X.AI (via OpenRouter pricing)
- [x] **Cache-aware billing** - Correctly handles prompt caching discounts
- [x] **Zero database required** - Send to console, webhook, or your existing logging
- [x] **Auto-updating prices** - Pricing changes tracked automatically

## Quick Start (3 minutes)

```typescript
// 1. Install
npm install ai-sdk-cost

// 2. Initialize tracking
import { initAiSdkCostTelemetry } from 'ai-sdk-cost';
initAiSdkCostTelemetry();

// 3. Add telemetry to your AI calls
await streamText({
  model: openai('gpt-4o'),
  experimental_telemetry: { isEnabled: true },
  // Your existing code...
});
```

That's it. You're now tracking costs. Check your console for:
```json
{
  "model": "gpt-4o",
  "cost_cents": 8,
  "user_id": "user-123",
  "input": 1250,
  "output": 430
}
```

## Installation

```bash
npm install ai-sdk-cost @opentelemetry/api @opentelemetry/sdk-trace-base @opentelemetry/sdk-trace-node
# or
pnpm add ai-sdk-cost @opentelemetry/api @opentelemetry/sdk-trace-base @opentelemetry/sdk-trace-node
```

## Full Setup Example

```ts
import { initAiSdkCostTelemetry, consoleSink } from 'ai-sdk-cost';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

// Initialize once at app startup
const telemetry = initAiSdkCostTelemetry({
  sink: consoleSink(), // or webhookSink('https://your-api.com/ingest')
});

// Use with your AI calls
const result = await streamText({
  model: openai('gpt-4o-mini'),
  messages: [{ role: 'user', content: 'Hello!' }],
  experimental_telemetry: {
    isEnabled: true,
    metadata: {
      userId: 'user-123',        // Optional: per-request override
      workspaceId: 'workspace-1'  // Optional: per-request override
    }
  }
});
```

Each request logs:
```json
{
  "time": "2025-01-01T12:34:56.789Z",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "input": 123,
  "output": 456,
  "cache_read": 896,
  "cache_write": 1024,
  "cost_cents": 8,
  "finish_reason": "stop",
  "user_id": "user-123",
  "workspace_id": "workspace-1",
  "traceId": "abc123...",
  "spanId": "def456..."
}
```

## Send Costs to Your Database

Choose from built-in sinks or create your own:

```ts
// Console output (default)
import { consoleSink } from 'ai-sdk-cost';
initAiSdkCostTelemetry({ sink: consoleSink() });

// Webhook endpoint
import { webhookSink } from 'ai-sdk-cost';
initAiSdkCostTelemetry({
  sink: webhookSink('https://your-api.com/ingest')
});

// Custom handler (write to your database)
import { callbackSink } from 'ai-sdk-cost';
initAiSdkCostTelemetry({
  sink: callbackSink(async (log) => {
    await db.insert('ai_costs', {
      user_id: log.user_id,
      cost_cents: log.cost_cents,
      model: log.model,
      timestamp: log.time
    });
  })
});
```

## Advanced Features

### Watch OpenRouter Pricing at Runtime

```ts
import { startOpenRouterPriceWatcher } from 'ai-sdk-cost';

const stop = startOpenRouterPriceWatcher({
  intervalMs: 6 * 60 * 60 * 1000,
  onUpdate(prices) {
    console.log('OpenRouter pricing changed', Object.keys(prices).length);
  }
});

// Later: stop();
```

### Access Bundled Pricing Data

The package ships with curated OpenRouter pricing for major providers. Access it without network calls:

```ts
import { getPackagedOpenRouterPricing } from 'ai-sdk-cost';

const pricing = getPackagedOpenRouterPricing();
// Returns pricing for OpenAI, Anthropic, Google, DeepSeek, X.AI models
```

### Provider-Specific Handling

The library correctly handles each provider's unique telemetry format:

- **OpenAI**: Cached tokens are included in `inputTokens` AND reported separately. We handle the deduplication automatically.
- **Anthropic**: Cache reads are correctly separated from input tokens. No double-counting.
- **Others**: Telemetry metadata is automatically extracted from various attribute formats.

### Examples

See the `examples/` directory for:
- `basic.ts` - Simple mock telemetry example
- `express.ts` - Production Express.js integration
- `test-external-openai.ts` - Live OpenAI integration test
- `test-external-anthropic.ts` - Live Anthropic integration test

### GitHub Action for Auto-Updating Prices

The included GitHub Action (`.github/workflows/publish-openrouter-prices.yml`) automatically updates pricing data weekly. To use in your repo:

1. Copy the workflow file
2. Set GitHub secrets for `GITHUB_TOKEN`
3. Pricing updates will be committed automatically

## Development

### Update Pricing Data
```bash
pnpm run fetch:prices  # Updates src/data/openrouter-pricing.json
```

### Run Tests
```bash
# Test pricing calculations
pnpm run test:pricing

# Live provider tests (requires API keys)
pnpm run test:external:openai
pnpm run test:external:anthropic
```

## License

MIT
