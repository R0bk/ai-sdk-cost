import '../scripts/register-span-fixture-logger'
import { initAiSdkCostTelemetry, consoleSink } from '../src';
import { ModelMessage, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

const telemetry = initAiSdkCostTelemetry({
  sink: consoleSink(),
  getContext: () => ({ userId: 'demo-user-anthropic', workspaceId: 'demo-workspace-anthropic' })
});

async function runAnthropic(prompt: string) {
  const messages: ModelMessage[] = [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: prompt,
          providerOptions: {
            anthropic: { cacheControl: { type: 'ephemeral' } }
          }
        }
      ]
    }
  ];

  const stream = await streamText({
    model: anthropic('claude-3-5-haiku-20241022'),
    messages,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: 'demo-user-anthropic',
        workspaceId: 'demo-workspace-anthropic'
      }
    }
  });

  const chunks: string[] = [];
  for await (const part of stream.textStream) {
    chunks.push(part);
  }
  const metadata = await stream.providerMetadata?.catch?.(() => undefined);
  const usage = await stream.usage?.catch?.(() => undefined);
  return { text: chunks.join(''), metadata, usage };
}

async function main() {
  if (!process.env.AI_ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error('Set AI_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY before running this script.');
    process.exit(1);
  }

  try {
    const paragraph = 'Anthropic cache control lets us reuse large safety policies, structured response schemas, and other long-lived context while paying only for deltas.';
    const longPrompt = Array.from({ length: 80 }, (_, idx) => `Clause ${idx + 1}: ${paragraph}`).join('\n');
    const cacheBuster = `cache-buster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const promptWithBuster = `${longPrompt}\nCache-Buster: ${cacheBuster}`;

    console.log(`Prompt word count ≈ ${longPrompt.split(/\s+/).length}; targeting >1024 tokens for cache eligibility.`);
    console.log('Warm-up call (fills cache)...');
    const warm = await runAnthropic(promptWithBuster);
    console.log('Warm usage (SDK):', warm.usage);
    console.log('Warm provider metadata:', warm.metadata);
    const warmUsage = (warm.metadata?.anthropic?.usage ?? {}) as Record<string, unknown>;
    const warmCreation = Number(warmUsage.cache_creation_input_tokens ?? 0);
    if (!(warmCreation > 0)) {
      throw new Error(
        `Expected Anthropic cache creation tokens > 0 on warm call, received ${warmCreation}`
      );
    }

    console.log('Second call (should reuse cache if provider supports it)...');
    const cool = await runAnthropic(promptWithBuster);
    console.log('Second usage (SDK):', cool.usage);
    console.log('Second provider metadata:', cool.metadata);
    const coolUsage = (cool.metadata?.anthropic?.usage ?? {}) as Record<string, unknown>;
    const coolRead = Number(coolUsage.cache_read_input_tokens ?? 0);
    if (!(coolRead > 0)) {
      throw new Error(
        `Expected Anthropic cache read tokens > 0 on second call, received ${coolRead}`
      );
    }
    if (Math.abs(coolRead - warmCreation) > 1e-6) {
      throw new Error(
        `Expected Anthropic cache read (${coolRead}) to match warm creation (${warmCreation})`
      );
    }
    console.log('Model output:', cool.text);
  } finally {
    await telemetry.tracerProvider.forceFlush();
    await telemetry.tracerProvider.shutdown();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
