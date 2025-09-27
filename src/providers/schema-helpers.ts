import { z } from 'zod/v4';

const finiteInt = z.number().int().min(0);

export const nullishInt = () => finiteInt.nullish();

