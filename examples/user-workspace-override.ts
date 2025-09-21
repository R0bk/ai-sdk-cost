import { initAiSdkCostTelemetry, consoleSink } from '../src/index';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

/**
 * Example: Per-call user and workspace override
 *
 * Shows how to override userId and workspaceId on individual calls
 * without pre-configuration.
 */

async function main() {
  // Initialize with global defaults
  const telemetry = initAiSdkCostTelemetry({
    sink: consoleSink(),
    getContext: () => ({
      userId: 'default-user',
      workspaceId: 'default-workspace'
    })
  });

  console.log('Testing per-call user and workspace override...\n');

  // Call 1: Uses global defaults
  console.log('Call 1 - Using global defaults:');
  await streamText({
    model: openai('gpt-4o-mini'),
    messages: [{ role: 'user', content: 'Say hello in 3 words' }],
    experimental_telemetry: {
      isEnabled: true
      // No metadata - will use defaults
    }
  });

  await telemetry.tracerProvider.forceFlush();

  // Call 2: Override userId only
  console.log('\nCall 2 - Override userId only:');
  await streamText({
    model: openai('gpt-4o-mini'),
    messages: [{ role: 'user', content: 'Say goodbye in 3 words' }],
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: 'specific-user-123'
        // workspaceId will use default
      }
    }
  });

  await telemetry.tracerProvider.forceFlush();

  // Call 3: Override both userId and workspaceId
  console.log('\nCall 3 - Override both userId and workspaceId:');
  await streamText({
    model: openai('gpt-4o-mini'),
    messages: [{ role: 'user', content: 'Say thanks in 3 words' }],
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        userId: 'customer-456',
        workspaceId: 'team-alpha'
      }
    }
  });

  await telemetry.tracerProvider.forceFlush();

  // Call 4: Test alternative attribute names (user_id, workspace_id)
  console.log('\nCall 4 - Alternative attribute names (user_id, workspace_id):');
  await streamText({
    model: openai('gpt-4o-mini'),
    messages: [{ role: 'user', content: 'Count to three' }],
    experimental_telemetry: {
      isEnabled: true,
      metadata: {
        user_id: 'underscore-user',
        workspace_id: 'underscore-workspace'
      }
    }
  });

  await telemetry.tracerProvider.forceFlush();

  console.log('\n✅ User/Workspace override test complete!');
  console.log('Check the logs above:');
  console.log('  - Call 1: Should show "default-user" and "default-workspace"');
  console.log('  - Call 2: Should show "specific-user-123" and "default-workspace"');
  console.log('  - Call 3: Should show "customer-456" and "team-alpha"');
  console.log('  - Call 4: Should show "underscore-user" and "underscore-workspace"');

  await telemetry.tracerProvider.shutdown();
}

main().catch(console.error);