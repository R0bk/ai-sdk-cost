import assert from 'node:assert/strict';
import { initAiSdkCostTelemetry, callbackSink } from '../src';

const collectLogs = async () => {
  const received: any[] = [];

  const telemetry = initAiSdkCostTelemetry({
    sink: callbackSink(log => {
      received.push(log);
    }),
    getContext: () => ({
      userId: 'global-default-user',
      workspaceId: 'global-default-workspace'
    })
  });

  const span1 = telemetry.tracer.startSpan('ai.streamText.doStream');
  span1.setAttributes({
    'operation.name': 'ai.streamText.doStream',
    'ai.operationId': 'ai.streamText.doStream',
    'gen_ai.system': 'openai',
    'gen_ai.request.model': 'gpt-4o-mini',
    'ai.model.provider': 'openai.responses',
    'ai.model.id': 'gpt-4o-mini',
    'gen_ai.usage.input_tokens': 100,
    'gen_ai.usage.output_tokens': 50
  });
  span1.end();

  const span2 = telemetry.tracer.startSpan('ai.streamText.doStream');
  span2.setAttributes({
    'operation.name': 'ai.streamText.doStream',
    'ai.operationId': 'ai.streamText.doStream',
    'gen_ai.system': 'openai',
    'gen_ai.request.model': 'gpt-4o-mini',
    'ai.model.provider': 'openai.responses',
    'ai.model.id': 'gpt-4o-mini',
    'gen_ai.usage.input_tokens': 100,
    'gen_ai.usage.output_tokens': 50,
    'ai.telemetry.metadata.userId': 'override-user-123',
    'ai.telemetry.metadata.workspaceId': 'override-workspace-456'
  });
  span2.end();

  await telemetry.tracerProvider.forceFlush();
  await telemetry.tracerProvider.shutdown();

  return received;
};

(async () => {
  const logs = await collectLogs();
  assert.equal(logs.length, 2, 'expected two logs to be captured');

  const [first, second] = logs;

  assert.equal(first.user_id, 'global-default-user');
  assert.equal(first.workspace_id, 'global-default-workspace');

  assert.equal(second.user_id, 'override-user-123');
  assert.equal(second.workspace_id, 'override-workspace-456');
})();
