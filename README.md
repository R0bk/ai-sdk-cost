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

### Using Proxy Services (Azure, LiteLLM, etc.)

When using proxy services, deployment names often don't match actual model names. You have two options:

#### Option 1: Global Model Mapping
Configure mappings upfront for known deployments:

```ts
initAiSdkCostTelemetry({
  modelMapping: {
    // Azure OpenAI deployments
    'my-gpt4-deployment': 'gpt-4o',
    'prod-claude': 'claude-3-5-sonnet-20241022',

    // LiteLLM proxy names
    'litellm/fast-model': 'gpt-4o-mini',
    'litellm/smart-model': 'gpt-4o',

    // Custom internal endpoints
    'team-a-llm': 'anthropic/claude-3-haiku-20240307'
  }
});
```

#### Option 2: Per-Call Override
Override the model name on individual calls without pre-configuration:

```ts
await streamText({
  model: customProxy('prod-deployment-xyz-123'),
  messages: [...],
  experimental_telemetry: {
    isEnabled: true,
    metadata: {
      modelName: 'gpt-4o', // Override for accurate pricing!
      userId: 'user-123'
    }
  }
});
```

Priority: Per-call `modelName` > `modelMapping` config > raw model name from provider.

### Debug Mode: Include Full Attributes

For debugging purposes, you can include all telemetry attributes in your logs:

```ts
initAiSdkCostTelemetry({
  includeAttributes: true,  // Default: false
  sink: consoleSink()
});
```

With `includeAttributes: true`, logs will include a full `attributes` field containing all OpenTelemetry span attributes. This is useful for debugging but should be disabled in production to reduce log size.

### Advanced: Using with Existing OpenTelemetry Setup

If you already have OpenTelemetry configured, you can integrate ai-sdk-cost with your existing setup:

```ts
import { AiSdkTokenExporter, consoleSink } from 'ai-sdk-cost';
import { BatchSpanProcessor, NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

// Create the exporter
const aiCostExporter = new AiSdkTokenExporter(consoleSink());

// Configure your provider with multiple exporters
const provider = new NodeTracerProvider({
  spanProcessors: [
    new BatchSpanProcessor(aiCostExporter),  // AI cost tracking
    new BatchSpanProcessor(yourOtherExporter) // Your existing telemetry
  ]
});

provider.register();
```

Note: Due to OpenTelemetry v2 changes, you cannot pass an existing provider to `initAiSdkCostTelemetry`. You must configure the provider with `AiSdkTokenExporter` when creating it.

### Provider-Specific Handling

The library correctly handles each provider's unique telemetry format:

- **OpenAI**: Cached tokens are included in `inputTokens` AND reported separately. We handle the deduplication automatically.
- **Anthropic**: Cache reads are correctly separated from input tokens. No double-counting.
- **Others**: Telemetry metadata is automatically extracted from various attribute formats.

### Examples

See the `examples/` directory for:
- `basic.ts` - Simple mock telemetry example
- `express.ts` - Production Express.js integration
- `model-mapping.ts` - Using proxy services with model mapping
- `openai-example.ts` - Live OpenAI integration test
- `anthropic-example.ts` - Live Anthropic integration test
- `google-example.ts` - Live Google Gemini integration test

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
pnpm run test:external:openai     # Requires OPENAI_API_KEY
pnpm run test:external:anthropic  # Requires ANTHROPIC_API_KEY
pnpm run test:external:google     # Requires GEMINI_API_KEY
```

[![npm version](https://badge.fury.io/js/ai-sdk-cost.svg)](https://www.npmjs.com/package/ai-sdk-cost)
[![npm downloads](https://img.shields.io/npm/dm/ai-sdk-cost.svg)](https://www.npmjs.com/package/ai-sdk-cost)


## License

MIT
