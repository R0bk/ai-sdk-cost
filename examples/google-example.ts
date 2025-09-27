import '../scripts/register-span-fixture-logger'
import { initAiSdkCostTelemetry, consoleSink } from '../src';
import { ModelMessage, streamText } from 'ai';
import { google } from '@ai-sdk/google';
import { generateModelMessages } from './fixtures';

const telemetry = initAiSdkCostTelemetry({
  sink: consoleSink(),
  getContext: () => ({ userId: 'demo-user-google', workspaceId: 'demo-workspace-google' })
});

async function runOnce(messages: ModelMessage[]) {
  const stream = await streamText({
    model: google('gemini-2.5-flash'),
    messages,
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: 'demo-user-google',
        workspaceId: 'demo-workspace-google'
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
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    console.error('Set GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY before running this script.');
    process.exit(1);
  }

  try {
    // Prompt caching requires >=1024 prompt tokens for Gemini 2.5 Flash
    const messages = generateModelMessages();

    console.log('Warm-up call (no cache)...');
    const warm = await runOnce(messages);
    console.log('Warm usage (SDK):', warm.usage);
    console.log('Warm provider metadata:', warm.metadata);

    console.log('Second call (should use implicit cache if provider supports it)...');
    const cool = await runOnce(messages);
    console.log('Second usage (SDK):', cool.usage);
    console.log('Second provider metadata:', cool.metadata);

    // Check for cached tokens in various possible locations
    const googleMetadata = cool.metadata?.google as Record<string, any> | undefined;
    const usageMetadata = googleMetadata?.usageMetadata as Record<string, any> | undefined;
    const cachedTokens = usageMetadata?.cachedContentTokenCount as number ?? 0;

    if (cachedTokens > 0) {
      console.log(`✅ Google implicit caching detected: ${cachedTokens} cached tokens on second call`);
    } else {
      console.log('ℹ️  No explicit cache tokens reported. Gemini 2.5 Flash should show cachedContentTokenCount.');
      console.log('    Check if the prompt meets the minimum token requirements for caching.');
    }

    console.log('Model output:', cool.text.substring(0, 200) + '...');
  } catch (err) {
    console.error('Error during Google example:', err);
    process.exit(1);
  }

  await telemetry.tracerProvider.forceFlush();
  await telemetry.tracerProvider.shutdown();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});