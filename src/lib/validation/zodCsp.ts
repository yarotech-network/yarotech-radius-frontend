type ZodGlobal = { __zod_globalConfig?: Record<string, unknown> };

/**
 * Stop zod probing `new Function` (its JIT feature check). The site's Content-Security-Policy
 * forbids eval, so the probe always fails and the browser logs a CSP violation on every form
 * page. Writing zod's shared global config here keeps zod out of the startup bundle; zod adopts
 * this object when it loads (and it is the same object if zod is already loaded).
 */
export function disableZodEval(): void {
  const scope = globalThis as ZodGlobal;
  Object.assign((scope.__zod_globalConfig ??= {}), { jitless: true });
}
