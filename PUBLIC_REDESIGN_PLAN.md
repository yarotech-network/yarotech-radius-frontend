# Public UI redesign

Scope: React 19 / TypeScript / Vite / React Router / Tailwind 4. Public routes: /, /pricing, /s/:slug, /s/:slug/checkout/:planId, /pay/result, /login, /agent/login, /register, /verify-email, /forgot-password, /reset-password, /accept-invitation. Features and About are homepage sections; there are no standalone contact or FAQ pages. Private dashboards and development showcase are excluded.

Reference: https://www.pulseisp.com/ and supplied desktop/mobile screenshots. Borrow composition principles (clear hero, product preview, navigation hierarchy, spacious forms, setup sequence) only. Preserve Yarotech logo, local Inter font, Lucide icons and existing product assets. No copied branding, metrics, trial offers or authentication steps.

Audit: minimal navigation/footer, narrow authentication forms, hidden mobile preview, repetitive boxed sections, inconsistent page spacing. PublicLayout and AuthSplitLayout control public presentation. Shared Button, Input, AuthCard and PlanCard also serve private screens, so their defaults are preserved. public.css scopes visual tokens and overrides to public-site; account selection/access screens retain a compact layout.

Implementation: public header/mobile disclosure/footer; homepage hero, capability strip, open feature grid, setup steps, existing API-fed plans, final CTA; consistent pricing, storefront/checkout, auth and payment-result typography and controls. API adapters, validation, authentication and payment effects are unchanged by this redesign. Existing unvalidated storefront payment recovery changes predate this work and are a separate concern.

## Validation (2026-09-08)

- Full repository ESLint and scoped public-file ESLint passed.
- TypeScript and Vite production build passed. Existing third-party Zod annotation warnings remain.
- Bundle budgets passed: initial JavaScript 136.5 kB gzip (150 kB budget); largest lazy chunk 36.7 kB (120 kB budget).
- LandingPage: 2 tests passed. Authentication flow, email verification and storefront suite: 29 tests passed, 1 deliberately excluded existing pending-payment recovery test. Initial fork workers timed out; retry with thread workers passed. This is not validation of the deferred backend/payment recovery work.
- Browser checks used intercepted sample API responses; all 12 public routes listed above rendered at 1440, 768, 390 and 320 pixels without horizontal overflow. No page errors. Mobile navigation opens; Escape closes it and returns focus. Homepage desktop/mobile screenshots were visually reviewed. No live account creation, payments or provider callbacks were exercised.
- Preserved the supplied logo and existing dashboard preview. Public visual tokens are isolated from private dashboards. No backend files were changed for this redesign.

