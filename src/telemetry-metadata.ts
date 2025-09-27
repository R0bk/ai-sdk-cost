import { z } from 'zod/v4';
import { packagedOpenRouterPricing } from './openrouter';

const openRouterModelNames = Object.keys(packagedOpenRouterPricing);
const openRouterModelSet = new Set(openRouterModelNames.map((key) => key.toLowerCase()));

const telemetryMetadataShape = {
  userId: z.string().min(1).optional(),
  workspaceId: z.string().min(1).optional(),
  modelName: z.string().min(1).optional()
};

export const telemetryMetadataSchema = z.looseObject(telemetryMetadataShape).check((ctx) => {
  const model = ctx.value.modelName;
  if (typeof model === 'string' && !openRouterModelSet.has(model.toLowerCase())) {
    ctx.issues.push({
      code: 'custom',
      message: `Unknown modelName "${model}". Ensure the override matches a packaged OpenRouter model id.`,
      path: ['modelName'],
      input: ctx.value,
      params: { model }
    });
  }
});

export type TelemetryMetadataInput = z.input<typeof telemetryMetadataSchema>;
export type TelemetryMetadata = z.infer<typeof telemetryMetadataSchema>;

export const knownOpenRouterModels = openRouterModelNames as readonly string[];

export const isKnownOpenRouterModel = (value: string): boolean => openRouterModelSet.has(value.toLowerCase());
