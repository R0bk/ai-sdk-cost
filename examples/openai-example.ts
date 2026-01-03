import '../scripts/register-span-fixture-logger'
import { initAiSdkCostTelemetry, consoleSink } from '../src';
import { ModelMessage, streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { generateModelMessages } from './fixtures';

const telemetry = initAiSdkCostTelemetry({
  sink: consoleSink(),
  getContext: () => ({ userId: 'demo-user-openai', workspaceId: 'demo-workspace-openai' })
});

async function runOnce(messages: ModelMessage[]) {
  const stream = await streamText({
    model: openai('gpt-5-mini'),
    messages,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: 'demo-user-openai',
        workspaceId: 'demo-workspace-openai'
      }
    },
    providerOptions: {
      openai: {
        promptCacheKey: 'ai-sdk-cost-demo-cache'
      }
    }
  });

  const chunks: string[] = [];
  for await (const part of stream.textStream) {
    chunks.push(part);
  }
  const metadata = stream.providerMetadata ? await stream.providerMetadata : undefined;
  const usage = stream.usage ? await stream.usage : undefined;
  return { text: chunks.join(''), metadata, usage };
}

async function main() {
  if (!process.env.AI_OPENAI_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error('Set AI_OPENAI_API_KEY or OPENAI_API_KEY before running this script.');
    process.exit(1);
  }

  const messages = generateModelMessages();
  try {
    console.log('Warm-up call (fills cache)...');
    const warm = await runOnce(messages);
    console.log('Warm usage (SDK):', warm.usage);
    console.log('Warm provider metadata:', warm.metadata);

    console.log('Second call (should reuse cache if provider supports it)...');
    const cool = await runOnce(messages);
    console.log('Second usage (SDK):', cool.usage);
    console.log('Second provider metadata:', cool.metadata);
    const cachedTokens = Number(
      (cool.usage?.cachedInputTokens ??
        cool.metadata?.openai?.cachedPromptTokens ??
        0)
    );
    if (!(cachedTokens > 0)) {
      throw new Error(
        `Expected OpenAI cached tokens > 0 on second call, received ${cachedTokens}`
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
