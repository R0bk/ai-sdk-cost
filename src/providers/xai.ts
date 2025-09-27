import { z } from 'zod/v4';
import { nullishInt } from './schema-helpers';

const xaiUsageSchema = z
  .looseObject({
    prompt_tokens: nullishInt(),
    completion_tokens: nullishInt(),
    total_tokens: nullishInt(),
    reasoning_tokens: nullishInt(),
    cached_tokens: nullishInt(),
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
