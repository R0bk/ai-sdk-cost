import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { AiSdkTokenExporter, consoleSink } from '../src';

async function main() {
  const provider = new NodeTracerProvider();
  provider.addSpanProcessor(
    new SimpleSpanProcessor(
      new AiSdkTokenExporter(consoleSink(), {
        getContext() {
          return { userId: 'demo-user', workspaceId: 'demo-workspace' };
        }
      })
    )
  );
  provider.register();

  const tracer = provider.getTracer('ai-sdk-cost-example');

  const span = tracer.startSpan('ai.generateText.doGenerate', undefined, undefined);
  span.setAttributes({
    'gen_ai.system': 'openai',
    'gen_ai.request.model': 'gpt-4o-mini',
    'gen_ai.usage.input_tokens': 128,
    'gen_ai.usage.output_tokens': 256,
    'ai.response.providerMetadata': JSON.stringify({
      usage: {
        prompt_tokens_details: { cached_tokens: 32 }
      }
    })
  });
  span.end();

  await provider.forceFlush();
  await provider.shutdown();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
