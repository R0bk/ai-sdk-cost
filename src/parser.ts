import type { NumberLike } from './types';

export const isRecord = <T>(value: T): value is T & Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
}

export const toFiniteNumber = (value: NumberLike): number | undefined => {
  if (value === undefined || value === null) return undefined;
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

export const toNumber = (value: unknown): number => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
}

export const getAttr = (attrs: Record<string, unknown> | undefined, keys: string[]): unknown => {
  if (!attrs) return undefined;

  for (const key of keys) {
    // First try direct attribute lookup (OpenTelemetry stores dotted keys as strings)
    if (key in attrs) {
      return (attrs as Record<string, unknown>)[key];
    }

    // Then try nested object traversal (for JSON parsed values)
    if (key.includes('.')) {
      const [root, ...rest] = key.split('.');
      if (!(root in attrs)) continue;
      let value: unknown = (attrs as Record<string, unknown>)[root];
      if (typeof value === 'string') {
        try {
          value = JSON.parse(value);
        } catch {
          // If JSON parse fails, the string might not be JSON
          // Continue to check if it's a nested object
        }
      }
      // Only traverse if we have an object
      if (value && typeof value === 'object') {
        let current = value as Record<string, unknown>;
        let found = true;
        for (const part of rest) {
          if (part in current) {
            current = current[part] as Record<string, unknown>;
          } else {
            found = false;
            break;
          }
        }
        if (found) return current;
      }
    }
  }
  return undefined;
}

export const parseMaybeJSON = (value: unknown): unknown => {
  if (value == null) return undefined;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return undefined;
    }
  }
  if (typeof value === 'object') return value;
  return undefined;
}
