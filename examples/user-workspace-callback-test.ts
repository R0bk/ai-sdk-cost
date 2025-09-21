import { initAiSdkCostTelemetry, callbackSink } from '../dist/index.js';

/**
 * Test that userId and workspaceId are correctly passed through
 * when using callback sink with both global defaults and per-call overrides
 */

async function main() {
  // Track what we receive in the callback
  const receivedLogs: any[] = [];

  // Initialize with callback sink to capture logs
  const telemetry = initAiSdkCostTelemetry({
    sink: callbackSink((log) => {
      console.log('Received log:', JSON.stringify(log, null, 2));
      receivedLogs.push(log);

      // Verify the fields we care about
      console.log(`  -> user_id: ${log.user_id || 'null'}`);
      console.log(`  -> workspace_id: ${log.workspace_id || 'null'}\n`);
    }),

    // Set global defaults
    getContext: () => ({
      userId: 'global-default-user',
      workspaceId: 'global-default-workspace'
    })
  });

  // Test 1: Mock span with global defaults
  console.log('=== Test 1: Global defaults ===');
  const span1 = telemetry.tracer.startSpan('ai.streamText.doStream');
  span1.setAttributes({
    'gen_ai.system': 'openai',
    'gen_ai.request.model': 'gpt-4o-mini',
    'gen_ai.usage.input_tokens': 100,
    'gen_ai.usage.output_tokens': 50
  });
  span1.end();
  await telemetry.tracerProvider.forceFlush();

  // Test 2: Override via experimental_telemetry.metadata.userId
  console.log('=== Test 2: Override via metadata.userId ===');
  const span2 = telemetry.tracer.startSpan('ai.streamText.doStream');
  span2.setAttributes({
    'gen_ai.system': 'openai',
    'gen_ai.request.model': 'gpt-4o-mini',
    'gen_ai.usage.input_tokens': 100,
    'gen_ai.usage.output_tokens': 50,
    'experimental_telemetry.metadata.userId': 'override-user-123',
    'experimental_telemetry.metadata.workspaceId': 'override-workspace-456'
  });
  span2.end();
  await telemetry.tracerProvider.forceFlush();

  // Test 3: Override via metadata with underscore notation
  console.log('=== Test 3: Override via metadata.user_id (underscore) ===');
  const span3 = telemetry.tracer.startSpan('ai.streamText.doStream');
  span3.setAttributes({
    'gen_ai.system': 'openai',
    'gen_ai.request.model': 'gpt-4o-mini',
    'gen_ai.usage.input_tokens': 100,
    'gen_ai.usage.output_tokens': 50,
    'experimental_telemetry.metadata.user_id': 'underscore-user',
    'experimental_telemetry.metadata.workspace_id': 'underscore-workspace'
  });
  span3.end();
  await telemetry.tracerProvider.forceFlush();

  // Test 4: Test JSON stringified metadata
  console.log('=== Test 4: JSON stringified metadata ===');
  const span4 = telemetry.tracer.startSpan('ai.streamText.doStream');
  span4.setAttributes({
    'gen_ai.system': 'openai',
    'gen_ai.request.model': 'gpt-4o-mini',
    'gen_ai.usage.input_tokens': 100,
    'gen_ai.usage.output_tokens': 50,
    'experimental_telemetry.metadata': JSON.stringify({
      userId: 'json-user',
      workspaceId: 'json-workspace'
    })
  });
  span4.end();
  await telemetry.tracerProvider.forceFlush();

  // Test 5: Direct attributes (ai.user.id)
  console.log('=== Test 5: Direct ai.user.id attributes ===');
  const span5 = telemetry.tracer.startSpan('ai.streamText.doStream');
  span5.setAttributes({
    'gen_ai.system': 'openai',
    'gen_ai.request.model': 'gpt-4o-mini',
    'gen_ai.usage.input_tokens': 100,
    'gen_ai.usage.output_tokens': 50,
    'ai.user.id': 'direct-ai-user',
    'ai.workspace.id': 'direct-ai-workspace'
  });
  span5.end();
  await telemetry.tracerProvider.forceFlush();

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total logs received: ${receivedLogs.length}`);

  const results = [
    { test: 'Test 1 (global defaults)', expected: { user: 'global-default-user', workspace: 'global-default-workspace' }},
    { test: 'Test 2 (metadata.userId)', expected: { user: 'override-user-123', workspace: 'override-workspace-456' }},
    { test: 'Test 3 (metadata.user_id)', expected: { user: 'underscore-user', workspace: 'underscore-workspace' }},
    { test: 'Test 4 (JSON metadata)', expected: { user: 'json-user', workspace: 'json-workspace' }},
    { test: 'Test 5 (ai.user.id)', expected: { user: 'direct-ai-user', workspace: 'direct-ai-workspace' }}
  ];

  results.forEach((result, i) => {
    const log = receivedLogs[i];
    if (log) {
      const passed = log.user_id === result.expected.user && log.workspace_id === result.expected.workspace;
      console.log(`${passed ? '✅' : '❌'} ${result.test}`);
      if (!passed) {
        console.log(`   Expected: user="${result.expected.user}", workspace="${result.expected.workspace}"`);
        console.log(`   Got:      user="${log.user_id}", workspace="${log.workspace_id}"`);
      }
    } else {
      console.log(`❌ ${result.test} - No log received`);
    }
  });

  await telemetry.tracerProvider.shutdown();
}

main().catch(console.error);