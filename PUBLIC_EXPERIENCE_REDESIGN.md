# Public experience redesign

Implemented in the frontend checkout on 2026-09-16. The intended audience is hotspot business operators on the marketing site and Wi-Fi buyers on tenant storefronts. This report covers the local working tree, not a deployed release.

## Delivered

- An operator-focused homepage with original illustrative imagery, actual application preview with sample data, benefits, setup steps, live business pricing, FAQ and workspace actions.
- Dedicated `/about` and `/contact` pages; expanded `/guide`; clearer business subscription cards at `/pricing`.
- Shared desktop form/image layouts and compact mobile forms for login, agent login, registration, email verification, password recovery and invitations. Registration retains its existing step controllers and explicit verification action.
- Compact tenant purchase layout for `/s/:slug/*` and `/pay/result`, order summaries, accurate payment-versus-delivery messaging and existing credential visibility controls.
- Tenant-keyed purchase content so navigating to another business does not carry the previous catalogue or form into the new context.
- Keyboard navigation, menu Escape/focus behavior, skip links, route descriptions, legacy `/#features` and `/#about` anchors, reduced-motion support and responsive images.
- Original logo retained with a 21.8 KB display derivative instead of the 1.37 MB source. Responsive ISP equipment images replace the earlier people scenes; the actual product preview is 111.2 KB.

Contact content is centralized in `src/features/storefront/publicContact.ts`. It uses the supplied email, telephone and Kano address. No WhatsApp channel or message form was added. Marketing copy does not claim invented customers, statistics or testimonials. The homepage intentionally no longer displays featured customer plans; the old `VITE_FEATURED_STOREFRONT_SLUG` setting does not enable a homepage catalogue. Existing tenant storefront URLs continue to work.

No backend APIs, database schemas, migrations, router files or authenticated dashboard workflows were changed. The shared logo asset is the only visual asset change also used by the authenticated shell.

## Assets and local preview

Run `npm.cmd run dev -- --host 127.0.0.1 --port 4175 --strictPort` from this frontend directory, then open `http://127.0.0.1:4175/` or `/login`.

Asset provenance and the exact built-in image-generation prompts are in `src/assets/images/README.md`. Generated images depict realistic ISP equipment without people; they are not photographs of actual Yarotech infrastructure. The product screenshot was captured from the real dashboard using intercepted demonstration responses; it contains no production data.

Local browser screenshots and reports are in the parent workspace's `staging-artifacts/public-review/`. The browser harness intercepts API requests and does not send purchases, messages or account changes to a backend. Its sample prices are test fixtures; application pricing continues to come from the configured API.

## Validation

- Focused storefront, registration, verification, subscription-guard and public-page tests: 47 passed initially. Follow-up coverage adds tenant switching and document metadata; 9 related tests passed. Authentication-routing tests: 15 passed. This is 65 distinct frontend tests across these runs.
- TypeScript checking, ESLint and the production build passed. Existing build warnings concern dependency annotations and subscription-module chunking.
- JavaScript budgets passed: approximately 148 KB gzip initial JavaScript against a 150 KB limit; largest lazy chunk approximately 37 KB against 120 KB.
- Browser checks exercised 15 public routes at 375, 768 and 1440 pixel widths: no overflow, broken loaded images, duplicate main headings or page JavaScript errors. Follow-up checks cover narrow account layouts, image failure, menu keyboard controls, metadata and anchors.
- Axe WCAG A/AA scans covered all 15 routes. The first scan found secondary-text contrast failures on checkout and payment-result pages; those were fixed and the targeted repeat passed.
- Browser screenshots were reviewed for homepage, account, contact and customer-purchase layouts. Deferred images were scrolled into view and decoded before final captures.
- Provider calls, server authorization, physical routers and production infrastructure were not exercised by these frontend checks.

## Production readiness

**NOT READY for a production-readiness claim.** Local implementation and frontend validation are complete; live integration and deployment evidence remain separate.

| Gate | Status | Evidence or rationale |
|---|---|---|
| Correctness | PASS | Local component, route and responsive-browser checks cover the implemented public journeys. |
| Validation | NOT VERIFIED | Form regression checks pass; authoritative server validation was not retested. |
| Authentication | NOT VERIFIED | Frontend authentication/verification routing passes; live email and session lifecycle were not retested. |
| Authorization | NOT VERIFIED | Frontend route guards preserved; server resource authorization was not exercised. |
| Transactions | N/A | No transaction or backend write implementation changed. |
| Concurrency | NOT VERIFIED | Tenant-switch regression passes; simultaneous provider/server requests were not exercised. |
| Idempotency | NOT VERIFIED | Existing frontend request-key and uncertain-checkout tests pass; durable backend deduplication was not retested. |
| Database constraints | N/A | No schema or database access changes. |
| Indexes | N/A | No database query changes. |
| Migration safety | N/A | No migrations prepared or applied. |
| Error handling | PASS | UI tests cover unavailable plans, pricing errors/retry, unknown payments and paid-but-unfulfilled results. |
| Logging | N/A | No new application logging or telemetry was introduced. |
| Metrics | NOT VERIFIED | Production latency and conversion metrics were not observed. |
| Tests | PASS | Focused frontend and browser checks described above. |
| Performance | PASS | Build budgets pass; responsive WebP assets and compact logo reduce image transfer. |
| Accessibility | NOT VERIFIED | Automated A/AA, keyboard and responsive checks pass; assistive-technology testing on physical devices remains unverified. |
| Backwards compatibility | PASS | Existing public URLs, auth guards and request/response contracts preserved; homepage audience change is documented above. |
| Documentation | PASS | Routes, contact ownership, assets, validation boundaries and release guidance documented here. |
| Deployment safety | NOT VERIFIED | No deployment or production smoke test performed. |
| Rollback strategy | NOT VERIFIED | Restore the previous frontend artifact if needed; rollback has not been rehearsed in the target environment. |

Before release, verify the configured API and public deep-link fallback on the target host, exercise account email/recovery and a controlled payment/access-delivery journey, and confirm the prior frontend artifact can be restored. Deployment topology and production traffic were not inspected in this UI task. No database rollback is required by this patch.
