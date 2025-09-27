# Telemetry Overrides (user/workspace/model)

This guide shows how to control telemetry overrides with strong typing and runtime validation.

## Core metadata schema

```ts
import { AiCostMetadataSchema, type AiCostMetadata } from 'ai-sdk-cost';

const metadata = {
  userId: 'user-123',
  workspaceId: 'workspace-456',
  modelName: 'gpt-4o'
} satisfies AiCostMetadata;

// Throws if the model name isn't in the bundled OpenRouter catalogue
AiCostMetadataSchema.parse(metadata);
```

* `AiCostMetadata` constrains `modelName` to the packaged set of OpenRouter model IDs.
* `AiCostMetadataSchema.parse(...)` enforces overrides at runtime, catching typos or stale IDs before spans are emitted.

## Using overrides in production code

```ts
import { AiCostMetadataSchema, type AiCostMetadata } from 'ai-sdk-cost';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

const metadata = {
  userId: 'customer-456',
  workspaceId: 'team-alpha',
  modelName: 'gpt-4o'
} satisfies AiCostMetadata;

const validatedMetadata = AiCostMetadataSchema.parse(metadata);

await streamText({
  model: openai(validatedMetadata.modelName),
  messages: [{ role: 'user', content: 'Summarize telemetry best practices.' }],
  experimental_telemetry: {
    isEnabled: true,
    metadata: validatedMetadata
  }
});
```

If per-call overrides are absent, the exporter falls back to `getContext` defaults or OpenTelemetry context values.

## Provider mapping fallbacks

When no override is provided, model resolution proceeds in order:

1. Per-call metadata (`ai.telemetry.metadata.modelName`)
2. Response model (`ai.response.model`)
3. Base model (`ai.model.id`)
4. Request model (`gen_ai.request.model`)

`modelMapping` in `initAiSdkCostTelemetry` lets you pre-map deployment names to canonical models, and the per-call override wins when both are present.

## Example: metadata override with validation

The combination of the typed metadata object and `experimental_telemetry.metadata` keeps overrides type-safe while allowing runtime validation before calls go out.
