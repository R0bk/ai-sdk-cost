import express from 'express';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { initAiSdkCostTelemetry, consoleSink } from '../src';

// Register telemetry once for the process.
initAiSdkCostTelemetry({ sink: consoleSink() });

const app = express();
app.use(express.json());

app.post('/api/chat', async (req, res, next) => {
  try {
    const metadata = {
      userId: (req.headers['x-user-id'] as string | undefined) ?? 'anonymous',
      workspaceId: (req.headers['x-workspace-id'] as string | undefined) ?? 'default'
    };

    const response = await streamText({
      model: openai('gpt-5-nano'),
      messages: req.body.messages,
      experimental_telemetry: {
        isEnabled: true,
        metadata
      }
    });

		res.json({ text: await response.text });
  } catch (error) {
    next(error);
  }
});

app.listen(3000, () => {
  console.log('Server listening on http://localhost:3000');
});
