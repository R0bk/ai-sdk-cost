import '../scripts/register-span-fixture-logger'
import { initAiSdkCostTelemetry, consoleSink } from '../src';
import { ModelMessage, streamText } from 'ai';
import { mistral } from '@ai-sdk/mistral';
import { generateModelMessages } from './fixtures';

const telemetry = initAiSdkCostTelemetry({
  sink: consoleSink(),
  getContext: () => ({ userId: 'demo-user-mistral', workspaceId: 'demo-workspace-mistral' })
});

async function runOnce(messages: ModelMessage[]) {
  const stream = await streamText({
    model: mistral('mistral-medium-latest'),
    messages,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: 'demo-user-mistral',
        workspaceId: 'demo-workspace-mistral'
      }
    },
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
  if (!process.env.MISTRAL_API_KEY) {
    console.error('MISTRAL_API_KEY before running this script.');
    process.exit(1);
  }

  const messages = generateModelMessages();

  try {
    console.log('Priming Mistral cache...');
    const warm = await runOnce(messages);
    console.log('Warm usage (SDK):', warm.usage);
    console.log('Warm provider metadata:', warm.metadata);
    console.log('Second call to check cache hit...');

    await new Promise(resolve => setTimeout(resolve, 3000));
    const cached = await runOnce(messages);
    console.log('Cached usage (SDK):', cached.usage);
    console.log('Cached provider metadata:', cached.metadata);
    const cachedTokens = Number(cached.usage?.cachedInputTokens ?? 0);

    if (!(cachedTokens > 0)) {
      throw new Error(`Expected cached tokens > 0 after reuse, received ${cachedTokens}`);
    }

    console.log('Model output:', cached.text);
  } finally {
    await telemetry.tracerProvider.forceFlush();
    await telemetry.tracerProvider.shutdown();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
