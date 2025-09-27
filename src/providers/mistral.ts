import { z } from 'zod/v4';
import { nullishInt } from './schema-helpers';

const mistralUsageSchema = z
  .looseObject({
    prompt_tokens: nullishInt(),
    completion_tokens: nullishInt(),
    total_tokens: nullishInt(),
    reasoning_tokens: nullishInt(),
    cached_tokens: nullishInt(),
  })
  .nullish();

export const mistralMetadataSchema = z.looseObject({
  mistral: z
    .looseObject({
      usage: mistralUsageSchema,
    })
    .nullish()
});

export type MistralProviderMetadata = z.infer<typeof mistralMetadataSchema>;
