import { initAiSdkCostTelemetry, consoleSink } from '../src/index';
import { context } from '@opentelemetry/api';

/**
 * Example: Model Mapping for Proxy Services
 *
 * When using LiteLLM, Azure OpenAI, or other proxy services,
 * deployment names often don't match actual model names.
 * Use modelMapping to ensure accurate pricing lookups.
 */

async function main() {
  // Initialize telemetry with model mapping
  const telemetry = initAiSdkCostTelemetry({
    sink: consoleSink(),

    // Map deployment/proxy names to actual model names
    modelMapping: {
      // Azure OpenAI deployments
      'my-gpt4-deployment': 'gpt-4o',
      'prod-claude-sonnet': 'claude-3-5-sonnet-20241022',
      'test-gemini': 'google/gemini-1.5-pro',

      // LiteLLM custom names
      'litellm/fast-model': 'gpt-4o-mini',
      'litellm/smart-model': 'gpt-4o',
      'litellm/cheap-model': 'gpt-3.5-turbo',

      // Custom proxy endpoints
      'internal/llm-gateway': 'anthropic/claude-3-haiku-20240307',
      'team-a-model': 'openai/gpt-4-turbo'
    },

    getContext: () => ({
      userId: 'user-123',
      workspaceId: 'workspace-456'
    })
  });

  // Simulate a span from a proxy service (e.g., Azure OpenAI)
  const span = telemetry.tracer.startSpan('ai.streamText.doStream');

  // Set attributes as they would appear from the proxy
  span.setAttributes({
    'gen_ai.system': 'azure-openai',
    'gen_ai.request.model': 'my-gpt4-deployment', // Azure deployment name
    'gen_ai.usage.input_tokens': 1500,
    'gen_ai.usage.output_tokens': 500,
    'ai.response.finishReason': 'stop'
  });

  span.end();

  // Another example with LiteLLM
  const litellmSpan = telemetry.tracer.startSpan('ai.generateText.doGenerate');

  litellmSpan.setAttributes({
    'gen_ai.system': 'litellm',
    'gen_ai.request.model': 'litellm/smart-model', // LiteLLM proxy name
    'gen_ai.usage.input_tokens': 2000,
    'gen_ai.usage.output_tokens': 750,
    'ai.response.finishReason': 'stop'
  });

  litellmSpan.end();

  // Example 3: Per-call model override (no pre-configured mapping needed!)
  const dynamicSpan = telemetry.tracer.startSpan('ai.streamText.doStream');

  dynamicSpan.setAttributes({
    'gen_ai.system': 'custom-proxy',
    'gen_ai.request.model': 'prod-deployment-xyz-123', // Unknown deployment name
    'experimental_telemetry.metadata.modelName': 'gpt-4o', // Override the model name for pricing!
    'gen_ai.usage.input_tokens': 1800,
    'gen_ai.usage.output_tokens': 600,
    'ai.response.finishReason': 'stop'
  });

  dynamicSpan.end();

  // Force flush and check output
  await telemetry.tracerProvider.forceFlush();

  console.log('\n✅ Model mapping example complete!');
  console.log('Check the logs above - deployment names should be mapped to actual models:');
  console.log('  - "my-gpt4-deployment" → "gpt-4o" (via modelMapping config)');
  console.log('  - "litellm/smart-model" → "gpt-4o" (via modelMapping config)');
  console.log('  - "prod-deployment-xyz-123" → "gpt-4o" (via per-call metadata override)');
  console.log('\nThis ensures correct pricing even when using proxy services.');

  await telemetry.tracerProvider.shutdown();
}

main().catch(console.error);