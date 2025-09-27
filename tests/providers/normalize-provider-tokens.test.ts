import assert from 'node:assert/strict';
import { normalizeProviderTokens } from '../../src/providers';
import type { CallLlmSpanAttributes } from '../../src/telemetry-types';
import type { StandardUsage } from '../../src/types';

const baseUsage: StandardUsage = {
  input: 100,
  output: 10,
  cacheRead: 0,
  cacheWrite: 0
};

const baseAttrs: CallLlmSpanAttributes = {
  'operation.name': 'ai.generateText.doGenerate',
  'ai.operationId': 'ai.generateText.doGenerate',
  'ai.model.id': 'base-model',
  'ai.model.provider': 'base-provider',
  'gen_ai.system': 'base-provider',
  'gen_ai.request.model': 'base-model',
  'gen_ai.usage.input_tokens': baseUsage.input,
  'gen_ai.usage.output_tokens': baseUsage.output
};

const anthropicMetadata = {
  anthropic: {
    usage: {
      input_tokens: 104,
      output_tokens: 12,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 2903
    },
    cacheCreationInputTokens: 0
  }
};

const openaiMetadata = {
  openai: {
    responseId: 'resp_test',
    serviceTier: 'default',
    usage: {
      input_tokens: 200,
      output_tokens: 20,
      cached_input_tokens: 50
    }
  }
};

const googleMetadata = {
  google: {
    usageMetadata: {
      promptTokenCount: 200,
      cachedContentTokenCount: 120
    }
  }
};

const serialize = (value: unknown) => JSON.stringify(value);

(() => {
  const attrs: CallLlmSpanAttributes = {
    ...baseAttrs,
    'ai.model.provider': 'anthropic',
    'gen_ai.system': 'anthropic',
    'ai.response.providerMetadata': serialize(anthropicMetadata)
  };

  const normalized = normalizeProviderTokens('anthropic', attrs, baseUsage);

  assert.equal(normalized.input, baseUsage.input);
  assert.equal(normalized.output, baseUsage.output);
  assert.equal(normalized.cacheRead, 2903);
  assert.equal(normalized.cacheWrite, 0);
})();

(() => {
  const attrs: CallLlmSpanAttributes = {
    ...baseAttrs,
    'ai.model.provider': 'openai',
    'gen_ai.system': 'openai',
    'ai.response.providerMetadata': serialize(openaiMetadata),
    'ai.usage.cachedInputTokens': 25
  };

  const sdkUsage: StandardUsage = {
    ...baseUsage,
    input: 200,
    output: 20
  };

  const normalized = normalizeProviderTokens('openai', attrs, sdkUsage);

  assert.equal(normalized.input, 150);
  assert.equal(normalized.output, 20);
  assert.equal(normalized.cacheRead, 50);
  assert.equal(normalized.cacheWrite, 0);
})();

(() => {
  const attrs: CallLlmSpanAttributes = {
    ...baseAttrs,
    'ai.model.provider': 'google',
    'gen_ai.system': 'google',
    'ai.response.providerMetadata': serialize(googleMetadata)
  };

  const sdkUsage: StandardUsage = {
    ...baseUsage,
    input: 220
  };

  const normalized = normalizeProviderTokens('google', attrs, sdkUsage);

  assert.equal(normalized.input, 100);
  assert.equal(normalized.output, baseUsage.output);
  assert.equal(normalized.cacheRead, 120);
  assert.equal(normalized.cacheWrite, 0);
})();

(() => {
  const attrs: CallLlmSpanAttributes = {
    ...baseAttrs,
    'ai.model.provider': 'anthropic',
    'gen_ai.system': 'anthropic',
    'ai.response.providerMetadata': anthropicMetadata
  };

  const normalized = normalizeProviderTokens('anthropic', attrs, baseUsage);

  assert.equal(normalized.input, baseUsage.input);
  assert.equal(normalized.output, baseUsage.output);
  assert.equal(normalized.cacheRead, 2903);
  assert.equal(normalized.cacheWrite, 0);
})();

(() => {
  const attrs: CallLlmSpanAttributes = {
    ...baseAttrs,
    'ai.model.provider': 'openai',
    'gen_ai.system': 'openai',
    'ai.response.providerMetadata': openaiMetadata
  };

  const sdkUsage: StandardUsage = {
    ...baseUsage,
    input: 180,
    output: 18
  };

  const normalized = normalizeProviderTokens('openai', attrs, sdkUsage);

  assert.equal(normalized.input, 130);
  assert.equal(normalized.output, 18);
  assert.equal(normalized.cacheRead, 50);
  assert.equal(normalized.cacheWrite, 0);
})();

(() => {
  const attrs: CallLlmSpanAttributes = {
    ...baseAttrs,
    'ai.model.provider': 'anthropic',
    'gen_ai.system': 'anthropic',
    'ai.response.providerMetadata': '{"invalid": }'
  };

  const normalized = normalizeProviderTokens('anthropic', attrs, baseUsage);

  assert.deepEqual(normalized, baseUsage);
})();
