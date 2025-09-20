# ai-sdk-cost

Tiny, DB-agnostic helper for the Vercel AI SDK.

- Logs tokens from AI SDK OpenTelemetry spans (time, model, input, output, cache_read, cache_write, cost_cents, finish_reason, user_id, workspace_id, trace/span IDs).
- Watches OpenRouter pricing (`/api/v1/models`) and notifies you when it changes.
- Ships a GitHub Action to publish the latest pricing JSON back to your repo.

> You must enable `experimental_telemetry` per-call while Vercel AI telemetry is experimental.

## Installation

```bash
corepack enable pnpm
pnpm add ai-sdk-cost \
  @opentelemetry/api @opentelemetry/sdk-trace-base @opentelemetry/sdk-trace-node
```

## Collect token logs from the AI SDK

Register the exporter and enable telemetry on your calls.

```ts
// instrumentation.ts
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { AiSdkTokenExporter, consoleSink } from 'ai-sdk-cost';

const provider = new NodeTracerProvider();
provider.addSpanProcessor(
  new SimpleSpanProcessor(
    new AiSdkTokenExporter(consoleSink(), {
      userIdAttributes: ['ai.user.id', 'gen_ai.user.id'],
      workspaceIdAttributes: ['ai.workspace.id'],
      getContext(span, attrs) {
        return {
          userId: (attrs['app.user.id'] as string | undefined) ?? undefined,
          workspaceId: (attrs['app.workspace.id'] as string | undefined) ?? undefined
        };
      }
    })
  )
);
provider.register();

// The optional second argument to AiSdkTokenExporter lets you map span attributes
// (or custom logic via getContext) into `user_id` / `workspace_id` fields on the
// exported logs.

// later in your AI call
import { generateText } from 'ai';

const response = await generateText({
  model: 'openai:gpt-4o-mini',
  prompt: 'Hello world',
  experimental_telemetry: { isEnabled: true }
});
```

Example output (newline JSON):

```json
{"time":"2025-01-01T12:34:56.789Z","provider":"openai","model":"gpt-4o-mini","input":123,"output":456,"cache_read":896,"cache_write":1024,"cost_cents":8,"finish_reason":"stop","user_id":"demo-user","workspace_id":"demo-workspace","traceId":"...","spanId":"..."}
```

To send logs elsewhere, pick another sink:

```ts
import { webhookSink } from 'ai-sdk-cost';

provider.addSpanProcessor(
  new SimpleSpanProcessor(new AiSdkTokenExporter(webhookSink('https://example.com/ingest')))
);
```

### Try the built-in example

After installing dependencies, run:

```bash
pnpm run example
```

This uses the dev dependencies to create a mock AI SDK span and prints the exported
token log to your console.


### Run live integration checks (optional)

These scripts call the Vercel AI SDK v5 (tested with 5.0.47) against real providers.
They require API keys and will emit actual telemetry spans through the exporter.

```bash
# OpenAI (expects AI_OPENAI_API_KEY or OPENAI_API_KEY)
pnpm run test:external:openai

# Anthropic (expects AI_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY)
pnpm run test:external:anthropic
```

Each script makes two identical calls to encourage providers with prompt
caching support to emit `cache_read`/`cache_write` usage metrics. The examples
use the official `@ai-sdk/openai` and `@ai-sdk/anthropic` provider adapters, so
they stay aligned with the latest AI SDK 5 behaviour (prompt caching, cache
control, etc.). Both scripts throw if the expected cache behaviour is not
observed (Anthropic must report cache writes on the first call and cache reads
on the second; OpenAI must report cache reads on the second call).

## Watch OpenRouter pricing at runtime

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

### Bundled pricing snapshot & cost helpers

The package ships with a curated OpenRouter pricing snapshot (`x-ai`, `openai`,
`anthropic`, `google`, `deepseek`). You can access it without hitting the
network:

```ts
import { getPackagedOpenRouterPricing } from 'ai-sdk-cost';

const pricing = getPackagedOpenRouterPricing();
```

If you maintain your own ledger, combine those prices with the usage numbers
from the exporter and your preferred cost calculator to write deterministic
per-request cost rows.

### Telemetry caveats (OpenAI vs. Anthropic)

- OpenAI includes cached prompt tokens in `usage.inputTokens` *and* reports
  `usage.cacheReadTokens`. We currently bill the cached portion at the cache
  rate and subtract it from the regular prompt bucket only when the totals
  allow. Once the SDK distinguishes the two explicitly we can remove the
  heuristics.
- Anthropic reports only fresh prompt tokens in `usage.input_tokens` and places
  cached tokens in `cache_read_input_tokens`. No adjustment is required; the
  exporter charges the cached bucket at the discounted rate and the remaining
  prompt tokens at the standard rate.
- Other providers may differ. If you notice mismatches, please open an issue or
  follow the pattern above to add provider-specific handling.

## GitHub Action: auto publish pricing JSON

`./.github/workflows/publish-openrouter-prices.yml` runs weekly (Mondays at
03:00 UTC) and commits `data/openrouter-pricing.json` when pricing changes.

To run the same script locally:

```bash
GITHUB_OWNER=your-org \
GITHUB_REPO=your-repo \
GITHUB_TOKEN=ghp_... \
pnpm run fetch:prices
```

When the GitHub variables are omitted, `pnpm run fetch:prices` saves the latest
prices to `src/data/openrouter-pricing.json`. The library bundle ships with that
file, so run the command (and `pnpm run build`) before publishing to ensure the
packaged pricing data is current.

## Publishing workflow

1. Refresh pricing and rebuild assets:
   ```bash
   pnpm run fetch:prices
   pnpm run build
   ```
2. Sanity check the snapshot and cost math:
   ```bash
   pnpm run test:pricing
   ```
3. (Optional) Run the live smoke tests with valid API keys to confirm telemetry
   and cache logging:
   ```bash
   pnpm run test:external:openai
   pnpm run test:external:anthropic
   ```
4. Publish as usual:
   ```bash
   pnpm publish
   ```

## License

MIT
