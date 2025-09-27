import assert from 'node:assert/strict';
import { initAiSdkCostTelemetry, callbackSink } from '../src';

const captureLogs = async () => {
  const received: any[] = [];

  const telemetry = initAiSdkCostTelemetry({
    sink: callbackSink(log => {
      received.push(log);
    }),
    modelMapping: {
      'my-gpt4-deployment': 'gpt-4o',
      'litellm/smart-model': 'gpt-4o',
      'internal/llm-gateway': 'anthropic/claude-3-haiku-20240307'
    },
    getContext: () => ({ userId: 'user-123', workspaceId: 'workspace-456' })
  });

  // Scenario 1: Azure-style deployment name mapped via modelMapping.
  const span1 = telemetry.tracer.startSpan('ai.streamText.doStream');
  span1.setAttributes({
    'operation.name': 'ai.streamText.doStream',
    'ai.operationId': 'ai.streamText.doStream',
    'ai.model.provider': 'azure-openai',
    'ai.model.id': 'my-gpt4-deployment',
    'gen_ai.system': 'azure-openai',
    'gen_ai.request.model': 'my-gpt4-deployment',
    'gen_ai.usage.input_tokens': 1500,
    'gen_ai.usage.output_tokens': 500
  });
  span1.end();

  // Scenario 2: LiteLLM proxy name mapped via modelMapping.
  const span2 = telemetry.tracer.startSpan('ai.generateText.doGenerate');
  span2.setAttributes({
    'operation.name': 'ai.generateText.doGenerate',
    'ai.operationId': 'ai.generateText.doGenerate',
    'ai.model.provider': 'litellm',
    'ai.model.id': 'litellm/smart-model',
    'gen_ai.system': 'litellm',
    'gen_ai.request.model': 'litellm/smart-model',
    'gen_ai.usage.input_tokens': 2000,
    'gen_ai.usage.output_tokens': 750
  });
  span2.end();

  // Scenario 3: Per-call metadata override should win even if mapping exists.
  const span3 = telemetry.tracer.startSpan('ai.streamText.doStream');
  span3.setAttributes({
    'operation.name': 'ai.streamText.doStream',
    'ai.operationId': 'ai.streamText.doStream',
    'ai.model.provider': 'custom-proxy',
    'ai.model.id': 'internal/llm-gateway',
    'gen_ai.system': 'custom-proxy',
    'gen_ai.request.model': 'internal/llm-gateway',
    'ai.telemetry.metadata.modelName': 'gpt-4o',
    'gen_ai.usage.input_tokens': 1800,
    'gen_ai.usage.output_tokens': 600
  });
  span3.end();

  // Scenario 4: No override, blank ai.model.id forces fallback to response model.
  const span4 = telemetry.tracer.startSpan('ai.streamText.doStream');
  span4.setAttributes({
    'operation.name': 'ai.streamText.doStream',
    'ai.operationId': 'ai.streamText.doStream',
    'ai.model.provider': 'custom-proxy',
    'ai.model.id': '',
    'gen_ai.system': 'custom-proxy',
    'gen_ai.request.model': 'fallback-deployment',
    'ai.response.model': 'litellm/smart-model',
    'gen_ai.usage.input_tokens': 900,
    'gen_ai.usage.output_tokens': 300
  });
  span4.end();

  await telemetry.tracerProvider.forceFlush();
  await telemetry.tracerProvider.shutdown();

  return received;
};

(async () => {
  const logs = await captureLogs();
  assert.equal(logs.length, 4, 'expected four mapped logs');

  const [azure, litellm, override, responseFallback] = logs;

  // Scenario 1: Base deployment mapped.
  assert.equal(azure.model, 'gpt-4o');

  // Scenario 2: LiteLLM proxy mapped.
  assert.equal(litellm.model, 'gpt-4o');

  // Scenario 3: Metadata override wins.
  assert.equal(override.model, 'gpt-4o');

  // Scenario 4: Response model used when base id is blank.
  assert.equal(responseFallback.model, 'gpt-4o');
})();
