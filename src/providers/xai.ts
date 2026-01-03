import { z } from 'zod/v4';
import { nullishInt } from './schema-helpers';

const xaiPromptTokenDetailsSchema = z
  .looseObject({
    cached_tokens: nullishInt(),
    uncached_tokens: nullishInt()
  })
  .nullish();

const xaiUsageSchema = z
  .looseObject({
    prompt_tokens: nullishInt(),
    completion_tokens: nullishInt(),
    total_tokens: nullishInt(),
    reasoning_tokens: nullishInt(),
    cached_tokens: nullishInt(),
    prompt_tokens_details: xaiPromptTokenDetailsSchema
  })
  .nullish();

const xaiLikeMetadataSchema = z
  .looseObject({
    usage: xaiUsageSchema,
    id: z.string().optional(),
    model: z.string().optional()
  })
  .nullish();

export const xaiMetadataSchema = z.looseObject({
  xai: xaiLikeMetadataSchema,
  grok: xaiLikeMetadataSchema
});

export type XaiProviderMetadata = z.infer<typeof xaiMetadataSchema>;
