import { z } from 'zod/v4';
import { nullishInt } from './schema-helpers';

const googleUsageMetadataSchema = z
  .looseObject({
    thoughtsTokenCount: nullishInt(),
    promptTokenCount: nullishInt(),
    candidatesTokenCount: nullishInt(),
    totalTokenCount: nullishInt(),
    cachedContentTokenCount: nullishInt()
  })
  .nullish();

export const googleMetadataSchema = z.looseObject({
  google: z
    .looseObject({
      usageMetadata: googleUsageMetadataSchema
    })
    .nullish()
});

export type GoogleProviderUsage = z.infer<typeof googleMetadataSchema>;
