import { z } from 'zod/v4';
import { packagedOpenRouterPricing } from './openrouter';
import openRouterPricingJson from './data/openrouter-pricing.json';

type RawOpenRouterModel = keyof typeof openRouterPricingJson;
export type KnownOpenRouterModel = Lowercase<RawOpenRouterModel>;

const openRouterModelNames = Object.keys(packagedOpenRouterPricing).map(
  (key) => key.toLowerCase() as KnownOpenRouterModel
);
const openRouterModelSet = new Set<KnownOpenRouterModel>(openRouterModelNames);

const AiCostMetadataShape = {
  userId: z.string().min(1).optional(),
  workspaceId: z.string().min(1).optional(),
  modelName: z.string().min(1).optional()
};

export const AiCostMetadataSchema = z.looseObject(AiCostMetadataShape).check((ctx) => {
  const model = ctx.value.modelName;
  if (typeof model === 'string' && !openRouterModelSet.has(model.toLowerCase() as KnownOpenRouterModel)) {
    ctx.issues.push({
      code: 'custom',
      message: `Unknown modelName "${model}". Ensure the override matches a packaged OpenRouter model id.`,
      path: ['modelName'],
      input: ctx.value,
      params: { model }
    });
  }
});

export type AiCostMetadata = {
  userId?: string;
  workspaceId?: string;
  modelName?: KnownOpenRouterModel;
};

export const knownOpenRouterModels = openRouterModelNames as readonly KnownOpenRouterModel[];

export const isKnownOpenRouterModel = (value: string): value is KnownOpenRouterModel =>
  openRouterModelSet.has(value.toLowerCase() as KnownOpenRouterModel);
