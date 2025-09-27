import { z } from 'zod/v4';
import { nullishInt, optionalString } from './schema-helpers';

const openaiUsageSchema = z
  .looseObject({
    input_tokens: nullishInt(),
    output_tokens: nullishInt(),
    total_tokens: nullishInt(),
    cached_input_tokens: nullishInt()
  })
  .nullish();

export const openaiMetadataSchema = z.looseObject({
  openai: z
    .looseObject({
      responseId: optionalString(),
      serviceTier: optionalString(),
      usage: openaiUsageSchema
    })
    .nullish()
});

export type OpenAIProviderUsage = z.infer<typeof openaiMetadataSchema>;
