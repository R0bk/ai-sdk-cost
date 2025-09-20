import type { TokenLog, TokenLogSink } from './types';

export const consoleSink = (): TokenLogSink => ({
  handle(log: TokenLog) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(log));
  }
});

export const callbackSink = (fn: (log: TokenLog) => void | Promise<void>): TokenLogSink => ({
  handle(log: TokenLog) {
    return fn(log);
  }
});

export const webhookSink = (url: string, fetchFn: typeof fetch = fetch): TokenLogSink => ({
  async handle(log: TokenLog) {
    await fetchFn(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(log)
    });
  }
});
