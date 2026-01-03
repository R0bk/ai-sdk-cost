import assert from 'node:assert/strict';
import { normalizeProviderTokens } from '../../src/providers';
import type { CallLlmSpanAttributes } from '../../src/telemetry-types';
import type { StandardUsage } from '../../src/types';

import anthropicNoCache from '../fixtures/stream-text/anthropic-no-cache.json' assert { type: 'json' };
import anthropicWithCache from '../fixtures/stream-text/anthropic-with-cache.json' assert { type: 'json' };
import googleNoCache from '../fixtures/stream-text/google-no-cache.json' assert { type: 'json' };
import googleWithCache from '../fixtures/stream-text/google-with-cache.json' assert { type: 'json' };
import mistralNoCache from '../fixtures/stream-text/mistral-no-cache.json' assert { type: 'json' };
import openaiNoCache from '../fixtures/stream-text/openai-no-cache.json' assert { type: 'json' };
import openaiWithCache from '../fixtures/stream-text/openai-with-cache.json' assert { type: 'json' };
import xaiNoCache from '../fixtures/stream-text/xai-no-cache.json' assert { type: 'json' };
import xaiWithCache from '../fixtures/stream-text/xai-with-cache.json' assert { type: 'json' };

type SpanFixture = { attributes: CallLlmSpanAttributes };

const asAttrs = (fixture: SpanFixture): CallLlmSpanAttributes => fixture.attributes;

const usageFromAttrs = (attrs: CallLlmSpanAttributes): StandardUsage => ({
  input: Number(attrs['gen_ai.usage.input_tokens']) || 0,
  output: Number(attrs['gen_ai.usage.output_tokens']) || 0,
  cacheRead:
    Number(
      (attrs as Record<string, unknown>)['ai.usage.cachedInputTokens'] ??
        (attrs as Record<string, unknown>)['gen_ai.usage.cachedInputTokens']
    ) || 0,
  cacheWrite: 0
});

type Expectation = {
  fixture: SpanFixture;
  expected: StandardUsage;
  label: string;
};

const expectations: Expectation[] = [
  {
    label: 'OpenAI without cache',
    fixture: openaiNoCache,
    expected: { input: 2221, output: 563, cacheRead: 0, cacheWrite: 0 }
  },
  {
    label: 'OpenAI with cache',
    fixture: openaiWithCache,
    expected: { input: 129, output: 481, cacheRead: 1792, cacheWrite: 0 }
  },
  {
    label: 'Google without cache',
    fixture: googleNoCache,
    expected: { input: 1995, output: 1205, cacheRead: 0, cacheWrite: 0 }
  },
  {
    label: 'Google with cache',
    fixture: googleWithCache,
    expected: { input: 985, output: 1585, cacheRead: 1010, cacheWrite: 0 }
  },
  {
    label: 'Anthropic without cache (cache creation tokens tracked)',
    fixture: anthropicNoCache,
    expected: { input: 3, output: 164, cacheRead: 0, cacheWrite: 2907 }
  },
  {
    label: 'Anthropic with cache hit',
    fixture: anthropicWithCache,
    expected: { input: 3, output: 113, cacheRead: 2907, cacheWrite: 0 }
  },
  {
    label: 'xAI without cache data',
    fixture: xaiNoCache,
    expected: { input: 1014, output: 54, cacheRead: 0, cacheWrite: 0 }
  },
  {
    label: 'xAI with cache data',
    fixture: xaiWithCache,
    expected: { input: 1831, output: 726, cacheRead: 152, cacheWrite: 0 }
  },
  {
    label: 'Mistral without cache data',
    fixture: mistralNoCache,
    expected: { input: 2162, output: 656, cacheRead: 0, cacheWrite: 0 }
  }
];

for (const { label, fixture, expected } of expectations) {
  (() => {
    const attrs = asAttrs(fixture);
    const normalized = normalizeProviderTokens(attrs['ai.model.provider'], attrs, usageFromAttrs(attrs));
    assert.deepEqual(normalized, expected, label);
  })();
}
