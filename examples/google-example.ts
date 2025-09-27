import { initAiSdkCostTelemetry, consoleSink } from '../src';
import { ModelMessage, streamText } from 'ai';
import { google } from '@ai-sdk/google';

const telemetry = initAiSdkCostTelemetry({
  sink: consoleSink(),
  getContext: () => ({ userId: 'demo-user-google', workspaceId: 'demo-workspace-google' })
});

async function runOnce(prompt: string) {
  const messages: ModelMessage[] = [
    {
      role: 'system',
      content:
        "You are a helpful assistant with extensive knowledge and capabilities. Your primary function is to provide accurate, comprehensive, and contextually appropriate responses to user queries across a wide range of topics including but not limited to science, technology, mathematics, literature, history, philosophy, arts, and general knowledge. You should always strive to be informative, clear, and engaging in your communication style. When responding to questions, consider multiple perspectives and provide well-reasoned explanations. If you're uncertain about something, acknowledge that uncertainty rather than providing potentially incorrect information. You should be respectful of different viewpoints and cultural sensitivities while maintaining objectivity. Your responses should be tailored to the apparent knowledge level and needs of the user, providing appropriate depth and complexity. When dealing with complex topics, break them down into understandable components and use examples or analogies when helpful. You should also be proactive in asking clarifying questions when the user's intent is ambiguous. Additionally, you should maintain a professional yet approachable tone throughout all interactions, being neither overly formal nor too casual. Your goal is to be genuinely helpful and to facilitate learning and understanding. You should also be aware of potential biases in your training data and strive to provide balanced perspectives. When appropriate, encourage critical thinking and independent verification of information, especially for important decisions or controversial topics. Remember that your role is to assist and inform, not to make decisions for users or to provide advice that could have significant personal, legal, or medical consequences without appropriate disclaimers."
    },
    {
      role: 'user',
      content: [{ type: 'text', text: prompt }]
    }
  ];

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
    const paragraph = 'Telemetry gives real-time insight into prompt size, latency, cache hits, and per-user spend so teams can tune prompts, cap runaway agents, and stay on budget.';
    const longPrompt = Array.from({ length: 50 }, (_, idx) => `Paragraph ${idx + 1}: ${paragraph}`).join('\n');
    const cacheBuster = `cache-buster-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const promptWithBuster = `${longPrompt}\nCache-Buster: ${cacheBuster}`;

    console.log(`Prompt word count ≈ ${longPrompt.split(/\s+/).length}; targeting >1024 tokens for implicit cache eligibility.`);
    console.log('Warm-up call (no cache)...');
    const warm = await runOnce(promptWithBuster);
    console.log('Warm usage (SDK):', warm.usage);
    console.log('Warm provider metadata:', warm.metadata);

    console.log('Second call (should use implicit cache if provider supports it)...');
    const cool = await runOnce(promptWithBuster);
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