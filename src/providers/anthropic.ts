import { z } from 'zod/v4';
import { nullishInt, optionalString } from './schema-helpers';

const anthropicCacheCreationSchema = z
  .looseObject({
    ephemeral_5m_input_tokens: nullishInt(),
    ephemeral_1h_input_tokens: nullishInt()
  })
  .nullish();

const anthropicUsageSchema = z
  .looseObject({
    input_tokens: nullishInt(),
    output_tokens: nullishInt(),
    cache_creation_input_tokens: nullishInt(),
    cache_read_input_tokens: nullishInt(),
    cache_creation: anthropicCacheCreationSchema,
    service_tier: optionalString()
  })
  .nullish();

export const anthropicMetadataSchema = z.looseObject({
  anthropic: z
    .looseObject({
      usage: anthropicUsageSchema,
      cacheCreationInputTokens: nullishInt()
    })
    .nullish()
});

export type AnthropicProviderUsage = z.infer<typeof anthropicMetadataSchema>;
