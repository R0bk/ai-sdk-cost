import { initAiSdkCostTelemetry, consoleSink } from '../src';

async function main() {
  const telemetry = initAiSdkCostTelemetry({
    sink: consoleSink(),
    getContext: () => ({ userId: 'demo-user', workspaceId: 'demo-workspace' })
  });

  const tracer = telemetry.tracer;
  const span = tracer.startSpan('ai.generateText.doGenerate');
  span.setAttributes({
    'gen_ai.system': 'openai',
    'gen_ai.request.model': 'gpt-4o-mini',
    'gen_ai.usage.input_tokens': 128,
    'gen_ai.usage.output_tokens': 256
  });
  span.end();

  await telemetry.tracerProvider.forceFlush();
  await telemetry.tracerProvider.shutdown();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
