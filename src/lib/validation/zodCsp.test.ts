import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { disableZodEval } from './zodCsp';

describe('disableZodEval', () => {
  it('switches zod to jitless mode so it never probes eval under the CSP', () => {
    disableZodEval();
    expect(z.config().jitless).toBe(true);
    expect(z.object({ a: z.string() }).parse({ a: 'x' })).toEqual({ a: 'x' });
  });
});
