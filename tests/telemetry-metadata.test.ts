import assert from 'node:assert/strict';
import { AiCostMetadataSchema, knownOpenRouterModels, isKnownOpenRouterModel } from '../src/telemetry-metadata';

const sampleModel = knownOpenRouterModels[0];

if (!sampleModel) {
  throw new Error('Expected packaged OpenRouter models to be available.');
}

const valid = AiCostMetadataSchema.safeParse({
  userId: 'user-123',
  workspaceId: 'workspace-456',
  modelName: sampleModel
});

assert.equal(valid.success, true);

assert.equal(isKnownOpenRouterModel(sampleModel), true);
assert.equal(isKnownOpenRouterModel('definitely-not-a-model'), false);

const invalid = AiCostMetadataSchema.safeParse({ modelName: 'definitely-not-a-model' });
assert.equal(invalid.success, false);

import { AiCostMetadata } from '../src/telemetry-metadata';

const metadata = {
  userId: 'user-123',
  workspaceId: 'workspace-456',
  modelName: sampleModel
} satisfies AiCostMetadata;
