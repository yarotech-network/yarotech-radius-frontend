# Admin and tenant page enhancement plan

## Scope and current status

Requested on 7 September 2026: use the supplied logo and plan improvements to the admin and tenant pages one at a time.

The supplied PNG is now the shared brand mark and browser icon. The original artwork is preserved at `src/assets/brand/yarotech-logo.png`; it is displayed proportionally inside a white tile. Existing application naming stays controlled by `VITE_APP_NAME`. Because `BrandMark` is shared, the logo also appears on authentication, public and agent layouts. The source image is approximately 1.37 MB; producing smaller approved web/icon assets is a future asset optimisation task, and the JavaScript bundle budget does not measure that image transfer.

The header/sidebar refresh and initial tenant Storefront page have already been implemented. Admin overview (step 1) and Tenant overview (step 2) are now implemented and checked with sample data. Storefront refinement (step 3) is implemented with automated checks; browser and live payment verification remain pending. The remaining page improvements are **planned**. Each numbered step is a separate reviewable change. Internet plans (step 4) is implemented; see its validation record below. Vouchers (step 5) is implemented; see its validation record below. Generate vouchers (step 6) is implemented; see its validation record below. Voucher details (step 7) is implemented; see its validation record below. Admin tenants (step 8) is implemented; see its validation record below. Admin tenant details (step 9) is implemented; see its validation record below. Tenant payments (step 10) is implemented; see its validation record below. Payment recovery (step 11) is implemented; see its validation record below. Admin payments (step 12) and the payment filter alignment follow-up are implemented; see the validation record below. Tenant routers (step 13) is implemented; see its validation record below. Register router (step 14) is implemented; see its validation record below. Router details (step 15) is implemented; see its validation record below. Router operations (step 16) is implemented; see its validation record below. Live sessions (step 17) is implemented; see its validation record below. Admin router fleet (step 18) is implemented; see its validation record below. Agents (step 19) is implemented; see its validation record below. Agent details (step 20) is implemented; see its validation record below. Devices (step 21) is implemented; see its validation record below. General settings (step 22) is implemented; see its validation record below. Billing and payouts (step 23) is implemented; see its validation record below. Team settings (step 24) is implemented; see its validation record below. The next page is **25: Subscription**.

## Design direction

- Use the supplied blue logo, navy navigation, bright blue primary actions and white content surfaces. Keep the complete logo visible without stretching, cropping or recolouring it.
- Give each page one clear title, a short purpose statement and a primary action appropriate to the current user's permissions. Keep the shared header focused on location, workspace and account context.
- Use consistent spacing, readable labels, restrained status colours and a clear distinction between summaries, filters, content and actions.
- Make long lists usable through existing server-backed search, filters, pagination and sorting. Adapt priority fields for mobile; keep secondary details accessible.
- Show loading, empty, error, refresh and mutation states deliberately. Preserve entered form values after failures and restore focus when dialogs close.
- Keep tenant identity visible around tenant-scoped actions. Preserve capability checks, current routes, money units, payment states and existing API contracts.
- Use real returned figures and observed timestamps. Trend charts, growth percentages, revenue date filters and readiness indicators require supporting API data before they can be designed as working features.

## One-page delivery cycle

1. Inspect that page's component, queries, types, permissions, related tests and current runtime response. Recheck existing API-gap notes against the current backend.
2. Write a small page-specific brief: main task, proposed layout, interactions, reused components, API limitations and acceptance checks.
3. Implement the page and only the shared changes it requires. Follow the existing React Router, TanStack Query and component patterns.
4. Verify its main workflow, permissions, loading/empty/error states and keyboard operation. Check 390px, 900px and 1440px widths, long names, large values and the collapsed sidebar.
5. Run relevant tests, type/build checks and lint. Inspect screenshots of the actual rendering; label sample-data previews separately from live verification.
6. Record changed files, screenshots, checks and remaining dependencies in the delivery log. Finish that page's reviewable result before starting the next numbered step. A backend dependency gets an explicit status, never simulated completion.

Database, authentication, payment, provisioning and other business-rule changes are outside this visual plan unless inspection identifies a necessary contract fix. Record such a fix separately with its impact and verification before implementation.

## Ordered backlog: first pages and sales workflows

Paths in the source column are relative to `src/features/`.

| Step | Page / route                                 | Source                                          | Proposed enhancement                                                                                                                                                                     | Page acceptance check                                                                                                                                     |
| ---- | -------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Admin overview `/platform`                   | `platform/pages/PlatformOverviewPage.tsx`       | A clear platform summary, grouped KPI cards, recent tenant activity and prominent links to existing tenant, router and payment tools. Separate data refresh status from business status. | Totals keep their existing meaning; partial failure of recent tenants does not hide successful figures; recent-tenant links open the correct record.      |
| 2    | Tenant overview `/dashboard`                 | `dashboard/pages/DashboardPage.tsx`             | A business summary, prioritised unpaid/unfulfilled attention items, clearer revenue/voucher/session cards, and permission-aware shortcuts including Storefront.                          | Cumulative revenue is labelled accurately; unavailable sessions are distinct from zero sessions; recovery and generation actions remain permission-gated. |
| 3    | Storefront `/storefront`                     | `storefront/pages/StorefrontManagementPage.tsx` | Refine link sharing into the primary task, improve public-plan preview cards and explain the business-profile, plan and payment setup steps.                                             | Copy/open uses the current tenant slug; preview uses the public catalogue; inactive or failed API states cannot appear as a ready-to-sell store.          |
| 4    | Internet plans `/plans`                      | `plans/pages/PlansPage.tsx`                     | Clear price, duration, data and speed hierarchy; streamlined search/status filters; improve create/edit dialogs and mobile plan summaries.                                               | Prices preserve kobo-to-naira conversion; deactivation and edit permissions remain intact; new or edited plans refresh the relevant list.                 |
| 5    | Voucher list `/vouchers`                     | `vouchers/pages/VouchersPage.tsx`               | Make access-code lookup, status and expiry easy to scan; improve filter grouping, row actions and mobile summaries.                                                                      | Search, paging, details and print actions work with actual records; sensitive credential presentation follows existing rules.                             |
| 6    | Generate vouchers `/vouchers/generate`       | `vouchers/pages/GenerateVouchersPage.tsx`       | A focused plan/quantity form, clear order summary, visible submitting state and useful generated-code/print results.                                                                     | Repeated submission cannot bypass existing idempotency behavior; results correspond to the returned batch; print uses authoritative credentials.          |
| 7    | Voucher details `/vouchers/:id`              | `vouchers/pages/VoucherDetailPage.tsx`          | Separate code information, plan, lifecycle and management actions; make copying/printing and status feedback easier to understand.                                                       | Legacy credential behavior is preserved; destructive actions retain confirmation and access checks; all displayed details come from the selected voucher. |
| 8    | Admin tenants `/platform/tenants`            | `platform/pages/TenantsPage.tsx`                | A clearer tenant directory with business identity, active state, meaningful counts, filtering and a consistent create/edit experience.                                                   | Tenant filtering and pagination remain server-backed; mobile records retain access to detail/actions; operator and platform records stay distinguishable. |
| 9    | Admin tenant details `/platform/tenants/:id` | `platform/pages/TenantDetailPage.tsx`           | A business profile summary, storefront entry point, linked operational sections and a visually separate danger zone.                                                                     | Router/payment/staff/audit links retain tenant scope; activation and deletion communicate their impact and preserve confirmation.                         |
| 10   | Tenant payments `/payments`                  | `payments/pages/PaymentsPage.tsx`               | Lead with payment status, amount, customer and reference; simplify filtering and detail inspection without implying unsupported daily totals.                                            | Successful, pending, failed and fulfilment outcomes remain distinct; values and references match the selected transaction.                                |
| 11   | Payment recovery `/payments/recovery`        | `payments/pages/RecoveryPage.tsx`               | An actionable queue with an explicit failure reason, order context, available recovery action and progress/result feedback.                                                              | Paid-but-unfulfilled orders remain visible until authoritative resolution; preserve retry, refund, permission and idempotency safeguards.                 |
| 12   | Admin payments `/platform/payments`          | `platform/pages/PlatformPaymentsPage.tsx`       | Clarify the voucher-sales, wallet and subscription tabs; keep tenant filters prominent and monetary columns consistent.                                                                  | Each tab uses its own endpoint and schema; switching tabs never mixes amounts or statuses from another payment source.                                    |

## Ordered backlog: network and operational pages

| Step | Page / route                            | Source                                   | Proposed enhancement                                                                                                              | Page acceptance check                                                                                                                          |
| ---- | --------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 13   | Tenant routers `/routers`               | `routers/pages/RoutersPage.tsx`          | Improve router identity, connectivity and last-observed information; make registration and operational actions easy to find.      | Stale, unknown and offline states are not presented as equivalent; assigned-staff visibility and tenant scope are preserved.                   |
| 14   | Register router `/routers/new`          | `routers/pages/NewRouterPage.tsx`        | Group connection and provisioning inputs into understandable steps; improve validation, explanatory text and submission feedback. | Required backend fields remain represented; submitted credentials are handled by existing secure paths; failed submissions retain safe inputs. |
| 15   | Router details `/routers/:id`           | `routers/pages/RouterDetailPage.tsx`     | Prioritise identity and connection state, then organise existing diagnostics, VPN and management sections by task.                | Displayed timestamps identify observed data; actions honour capability flags and permissions; secrets remain protected.                        |
| 16   | Router operations `/routers/operations` | `routers/pages/RouterOperationsPage.tsx` | Make operation selection, progress, failure details and permitted retries easier to follow.                                       | Queued or pending work stays pending until confirmed; unsupported capabilities remain clearly unavailable.                                     |
| 17   | Live sessions `/sessions`               | `sessions/pages/SessionsPage.tsx`        | A readable connection list with key session fields, refresh information, filters and a deliberate disconnect interaction.         | Polling/refresh behavior remains intact; disconnect targets the intended session and keeps its existing permission/confirmation requirements.  |
| 18   | Admin router fleet `/platform/routers`  | `platform/pages/PlatformRoutersPage.tsx` | A cross-tenant fleet view with clear operator identity, filters and readable device status.                                       | The tenant column and filter remain visible and accurate; a displayed status comes from the API rather than a UI assumption.                   |
| 19   | Agents `/agents`                        | `agents/pages/AgentsPage.tsx`            | Improve reseller identification, existing balance/status fields, search and create/edit forms.                                    | Active filters, currency formatting and management permissions remain correct; unsupported commission figures are not invented.                |
| 20   | Agent details `/agents/:id`             | `agents/pages/AgentDetailPage.tsx`       | Separate profile, wallet/allocation activity and management actions; make funding context and pending/results clear.              | Financial amounts and actions preserve existing transaction behavior; profile and history remain scoped to the selected agent.                 |
| 21   | Devices `/devices`                      | `devices/pages/DevicesPage.tsx`          | Improve device identity, ownership/connection information and existing action controls for desktop and mobile.                    | Only API-supported status and actions are shown; long identifiers remain readable without horizontal page overflow.                            |

## Ordered backlog: settings, access and audit

| Step | Page / route                          | Source                                        | Proposed enhancement                                                                                                                        | Page acceptance check                                                                                                                          |
| ---- | ------------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 22   | General settings `/settings/general`  | `settings/pages/GeneralSettingsPage.tsx`      | Separate customer-facing business details from personal account information; clarify which fields affect the storefront and printed output. | Existing edit permissions remain intact; validation is field-specific; saving preserves API-managed fields such as the slug.                   |
| 23   | Billing settings `/settings/billing`  | `settings/pages/BillingSettingsPage.tsx`      | Clearly group payment-provider credentials and business rules; explain unchanged/empty secret fields and save feedback.                     | Write-only keys are never exposed or falsely shown as configured; blank values preserve the existing patch semantics.                          |
| 24   | Team settings `/settings/team`        | `settings/pages/TeamSettingsPage.tsx`         | A clearer member directory, role explanations, add-member flow and accessible role/removal controls.                                        | Owner-only mutations remain gated; numeric user-ID limitations are explained honestly; do not add an unsupported user search.                  |
| 25   | Subscription `/settings/subscription` | `settings/pages/SubscriptionSettingsPage.tsx` | Emphasise current plan and expiry, improve plan comparison and keep checkout progress/results visible.                                      | Platform subscription charges remain separate from customer Wi-Fi purchases; pending, failed and confirmed outcomes stay distinct.             |
| 26   | Admin staff access `/platform/staff`  | `platform/pages/StaffPage.tsx`                | Clarify invitations versus assignments; show selected tenant and service grants prominently; improve invite-copy and revoke/edit flows.     | A one-time invitation token is handled as sensitive; grants keep their exact tenant/service scope; no implied email delivery without evidence. |
| 27   | Tenant audit `/audit`                 | `audit/pages/AuditPage.tsx`                   | Improve event scanning, actor/time/action hierarchy, filters and detail readability.                                                        | Events remain tenant-scoped and read-only; long payloads are readable and sensitive material is not newly exposed.                             |
| 28   | Admin audit `/platform/audit`         | `platform/pages/PlatformAuditPage.tsx`        | Reuse the refined audit presentation with prominent cross-tenant context and filtering.                                                     | Cross-tenant visibility remains administrator-only; selected tenant filters apply to both the visible records and pagination.                  |

## Explicit boundaries and dependencies

- Route inventory comes from `src/app/router/index.tsx`; navigation and role visibility come from `src/app/navigation/navConfig.ts` and `src/services/auth/principal.ts`. Each page is subject to its existing capability guard.
- `/payments/:id` is currently a redirect, and `/settings/profile` is an alias. Improve their destination workflows rather than creating duplicate pages.
- Customer catalogue `/s/:slug`, checkout and `/pay/result` form an adjacent customer journey. Step 3 verifies its links and compatibility; a separate customer-page redesign can follow this dashboard backlog.
- Agent portal, authentication and public marketing pages receive the shared logo now. Their page layouts are outside this admin/tenant backlog.
- Existing components include `PageHeader`, cards/stats, `DataTable`, `FilterBar`, pagination, form fields, dialogs and query feedback. Reuse them; a shared component change must be checked on its other consumers.
- `DashboardPage.tsx` explicitly notes that historical trends are not supplied by the API. The initial overview designs must work with existing totals. Any new chart or time-filtered metric first needs a verified contract and backend implementation.
- `analysis/05_API_GAPS.md` contains historical findings and later resolutions. It is an investigation guide, not proof that every recorded limitation still exists; verify each relevant endpoint when its page is reached.
- The latest local runtime check in this session returned HTML 404s for API v1 on port 8000. Recheck the matching backend before claiming live functionality. Visual fixtures can validate layout but cannot validate payment settlement, email, router provisioning or access-code delivery.

## First page brief: Admin overview

**User task:** understand platform activity and reach the operator or operational area needing attention.

**Existing implementation:** `platform/pages/PlatformOverviewPage.tsx` loads platform statistics and recent tenants separately through `usePlatformStats` and `useTenants`. It already has aggregate cards, recent-tenant links and operational shortcuts.

**Proposed layout:** retain the shared logo/header/sidebar; place a concise page introduction and real refresh information first, arrange the existing statistics into a consistent card grid, then present recent operators beside shortcuts to existing management pages. Use the current response fields only. A graph or a calculated health score is not part of this first pass.

**Implementation order:** inspect current API responses and permissions; sketch content priority; refine cards and recent-tenant rows; check independent query states; test navigation and role handling; capture desktop/tablet/mobile views; document results. No database migration or new endpoint is assumed.

**Verification:** run the relevant cases in `src/features/platform/platform.test.tsx` plus shared-shell tests if shared components change; build and lint touched code; verify real API data when available. Include zero tenants, large counts, long business names, partial errors and an active mobile drawer in the review.

## Delivery log

| Item                            | Status                              | Evidence / next action                                                                                  |
| ------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Shared dashboard header/sidebar | Implemented in the preceding change | Shell tests and responsive sample-data browser checks were completed; revisit if shared layout changes. |
| Supplied logo                   | Implemented                         | Original file copied into app assets; `BrandMark.tsx` and `index.html` reference it.                    |
| Pages 1–28                      | Planned                             | Start with Admin overview; append a page-specific result here after each delivery.                      |

For each completed page, record: date, changed files, working routes/actions, role checks, automated checks, screenshot widths, live verification status and unresolved dependencies. Use **implemented**, **verified**, **blocked**, or **planned** precisely; a working visual preview alone does not establish production readiness.

### Step 1 delivery ? Admin overview (7 September 2026)

Changed `src/features/platform/pages/PlatformOverviewPage.tsx` and its cases in `src/features/platform/platform.test.tsx`. The page now groups platform totals and payment sources, links directly to the relevant payment source/status, places recent tenants beside operational shortcuts, and refreshes both queries through a single control. A failed refresh retains the previous data with an explicit warning; initial failures are independent between sections. Existing admin route protection and API contracts are unchanged.

Six focused overview tests passed, covering successful content, partial failures, empty tenants, source/status links and stale-data refresh behavior. Lint and formatting checks passed. Desktop/tablet/mobile sample-data browser checks at 1440px, 900px and 390px found and resolved a long-slug grid overflow; final measurements showed no horizontal page overflow. The supplied logo loaded in the shared sidebar, and the mobile drawer was inspected. Local preview captures are in `%TEMP%/yarotech-overview-review/` (`overview-1440.png`, `overview-900.png`, `overview-390.png`, `overview-drawer.png`). These previews use synthetic data; they do not establish live API or production readiness.

No database or API changes were required. Live authenticated data verification remains pending the matching API backend. Next delivery: step 2, Tenant overview; preserve its existing recovery warnings, session permissions, cumulative figures and tenant scope while improving its layout.

### Step 2 delivery ? Tenant overview (7 September 2026)

Updated `src/features/dashboard/pages/DashboardPage.tsx`, the live-query enablement in `src/features/dashboard/queries.ts`, and dashboard navigation prefetch in `src/app/navigation/routeQueries.ts`. Added the existing Storefront route to the chunk-prefetch registry so navigation coverage stays consistent. Regression coverage is in `src/features/dashboard/dashboard.test.tsx` and `src/app/navigation/prefetch.test.ts`.

The page now leads with cumulative revenue and business totals, retains the paid-but-unfulfilled warning, separates live-session feedback from business-stat failures, and offers permission-aware Storefront and operational shortcuts. Manual refresh preserves stale results with warnings. Users without session permission no longer trigger live-user requests on dashboard mount, refresh or dashboard prefetch; disabling polling alone still leaves the initial fetch enabled for existing session-page consumers. Backend tenant scoping and permissions remain authoritative.

Validation: eight dashboard/session tests and five navigation-prefetch tests passed. TypeScript/production build passed. Browser previews with a long tenant name, large revenue and recovery warnings fit 1440px, 900px and 390px without horizontal overflow; the mobile drawer was also captured. Local sample-data screenshots are in `%TEMP%/yarotech-tenant-overview-review/`. These are layout checks, not live business-data verification. No database or API changes were needed. Next delivery: step 3, refine the tenant Storefront page.


### Step 3 delivery - Storefront management (7 September 2026)

Updated `src/features/storefront/pages/StorefrontManagementPage.tsx` and its regression tests. The tenant customer link now leads the page, with copy/open actions, accessible copy feedback and manual instructions when clipboard access fails. A purchase guide explains payment and voucher confirmation. Three setup cards lead to plans, business profile and billing. The customer catalogue shows the displayed/total plan count, checkout preview links and an independent refresh control. Failed profile or catalogue refreshes preserve prior data with visible warnings. Business activity is shown without claiming payment configuration is verified.

Validation: 20 storefront management and public purchase-flow tests passed, including tenant-specific links, staff route denial, anonymous catalogue requests, inactive/empty/error states, copying and stale catalogue recovery. Scoped ESLint, formatting and the TypeScript/production build passed. Browser screenshots and live payment verification were not performed for this delivery. The supplied logo remains in the shared dashboard shell. No API or database changes were required. Next delivery: step 4, Internet plans.


### Step 4 delivery - Internet plans (7 September 2026)

Enhanced `src/features/plans/pages/PlansPage.tsx` and `src/features/plans/components/PlanForm.tsx`. The catalogue now provides explicit active/inactive labels, a result count scoped to the current filters, manual refresh with stale-data warnings, and a permission-aware Storefront link. Existing mobile cards, sorting, URL search/filter state, pagination and plan actions remain in place. Create/edit fields are grouped into package details, connection limits, and sales/voucher settings, with explicit naira input guidance. The shared supplied logo remains unchanged.

Validation: seven focused tests, scoped ESLint, formatting and the TypeScript/production build passed. Regression checks cover list filters, retry, staff restrictions, creation with server validation, kobo conversion, and stale refresh recovery. Browser and live-backend verification were not performed for this delivery. No API or database changes. Next delivery: step 5, Vouchers.


### Step 5 delivery - Vouchers (7 September 2026)

Enhanced `src/features/vouchers/pages/VouchersPage.tsx`: grouped lookup controls, query-scoped result counts, manual refresh and visible stale-result warnings, independent plan-filter failure/retry, and direct keyboard-accessible voucher detail links. Mobile cards now expose selection for existing batch printing. Missing expiry dates on non-unused vouchers no longer imply they have never been activated. Existing status tabs, search, pagination, row actions and server print payloads are preserved; no password fields were added to the list.

Validation: 16 voucher UI, rules and printing tests passed, including mobile selection, staff action restrictions and stale refresh recovery. Scoped ESLint, formatting, TypeScript/production build and bundle budget checks passed. Browser and live-backend verification were not performed for this delivery. The shared supplied logo remains unchanged. No API or database changes. Next delivery: step 6, Generate vouchers.


### Step 6 delivery - Generate vouchers (7 September 2026)

Enhanced `src/features/vouchers/pages/GenerateVouchersPage.tsx` and the shared `PlanPicker.tsx`. The form now presents plan selection, batch settings and review as three clear steps. The review shows unit price, quantity, selected-plan specifications and total face value, with a distinction between face value and money collected. Invalid batch quantities no longer produce a misleading face-value total. Generated results use the returned batch count and readable links to actual vouchers, with existing authoritative credential printing and another-batch actions. Plan cards and generated usernames wrap on small screens and with long names.

Validation: 17 voucher UI, rules and printing tests passed. The new regression verifies that generating another batch uses a distinct request key and displays the returned usernames. Scoped lint, formatting, TypeScript/production build and bundle budget checks passed. Existing creation payloads, retry-key ownership, permissions and print endpoints are unchanged. Browser and live-backend verification were not performed for this delivery. No API or database changes; shared logo retained. Next delivery: step 7, Voucher details.


### Step 7 delivery - Voucher details (7 September 2026)

Enhanced `src/features/vouchers/pages/VoucherDetailPage.tsx`. Plan/device information, lifecycle dates and credentials now have separate sections. Long usernames/access codes wrap, and refresh failures retain the loaded voucher with an explicit warning. Missing activation timestamps on non-unused vouchers are shown as unavailable rather than implying no usage. Existing single-code and legacy-password presentation, print endpoints, source information and destructive confirmation steps remain intact.

The edit drawer now checks the same management permission and editable voucher state as the Edit button, including navigation through `?edit=1`. Disable/delete dialogs and callbacks also re-check their existing permission and state rules. These are client UI checks; server authorization remains authoritative. Validation: all 20 voucher tests passed on rerun with a 15-second test timeout after one existing list/print case exceeded five seconds. Scoped lint, formatting, TypeScript/production build and bundle budget checks passed. Regression cases cover denied URL editing for staff and active vouchers, stale refresh behavior and existing disable/print workflows. Browser and live-backend verification were not performed. No API or database changes; shared supplied logo retained. Next delivery: step 8, Admin tenants.


### Step 8 delivery - Admin tenants (7 September 2026)

Enhanced `src/features/platform/pages/TenantsPage.tsx` and shared `components/TenantDialog.tsx`. The directory now has linked business names, explicit operator/platform labels, wrapping storefront/contact information, counts scoped to the current query, and refresh recovery that preserves loaded results. Existing member/voucher counts, server search/status/kind filtering, pagination and detail navigation are preserved. The shared create/edit form groups business identity and contact information without changing validation, slug suggestion or mutation payloads.

Validation: six tenant-focused tests passed (15 unrelated cases skipped), covering creation, slug conflicts, platform-kind filtering, stale refresh recovery and existing tenant detail actions. Scoped ESLint, formatting, TypeScript/production build and bundle budget checks passed. Browser and live-backend verification were not performed. No API/database changes; shared logo and platform route protection retained. Next delivery: step 9, Admin tenant details.


### Step 9 delivery - Admin tenant details (7 September 2026)

Enhanced `src/features/platform/pages/TenantDetailPage.tsx`. A workspace summary now presents tenant type, member/voucher counts and a copyable storefront URL. Business profile, scoped operational links, member management, activation and deletion have distinct sections. Long content uses wrapping and responsive grids; the supplied logo remains in the shared shell. Existing member tabs and typed deletion confirmation are preserved. Profile refresh failures retain prior data with a visible warning, while 404 still displays the existing not-found page. Changing tenant identity resets local dialogs.

Validation: seven tenant-focused tests passed (15 unrelated cases skipped). Scoped lint, formatting, TypeScript/production build and bundle budget checks passed. Regression coverage checks storefront copying, payment/staff/audit tenant scope, refresh failure after automatic retries, and existing creation/activation/deletion behavior. Browser and live-backend verification were not performed. No API/database changes. Next delivery: step 10, Tenant payments.


### Step 10 delivery - Tenant payments (7 September 2026)

Enhanced `src/features/payments/pages/PaymentsPage.tsx` and `components/PaymentDrawer.tsx`. The list now has a clear history section, query-scoped counts, inline search/status filtering, keyboard-accessible reference controls, emphasized amounts and refresh warnings that retain loaded transactions. Successful payments with no linked voucher show a separate warning in the list and drawer. The drawer retains authoritative detail queries, voucher links and role-aware recovery hand-off; long references wrap. No revenue totals or new payment actions were introduced.

Validation: nine payment/recovery tests passed, including status filtering, amount formatting, staff/manager recovery permissions, paid-without-voucher details and stale refresh recovery. Scoped lint, formatting, TypeScript/production build and bundle budget checks passed. Browser and live-backend verification were not performed. Existing API contracts, payment mutations, shared branding and tenant scope remain unchanged. Next delivery: step 11, Payment recovery.


### Step 11 delivery - Payment recovery (7 September 2026)

Enhanced `src/features/payments/pages/RecoveryPage.tsx` and `components/RecoveryDrawer.tsx`. The queue now has an explicit current-page attention scope, grouped inline filters, keyboard-accessible references, readable attention reasons and independent refresh/filter errors. Loaded unresolved payments remain visible on refresh failure. Empty attention results no longer claim every email was delivered. Drawer actions fit narrow screens; changing the selected payment resets local notices and resend acknowledgement. Existing retry/delivery permissions, provider verification, duplicate acknowledgement and mutation contracts remain intact.

Validation: ten payment/recovery tests passed, including page-scoped attention filtering, stale unresolved rows, provider failure, duplicate-email acknowledgement and permission checks. Scoped lint, formatting, TypeScript/production build and bundle budget checks passed. Browser and live-backend verification were not performed. No API/database changes; shared logo retained. Next delivery: step 12, Admin payments.


### Step 12 delivery - Admin payments and inline payment filters (7 September 2026)

Added an opt-in single-row layout to `src/components/data/FilterBar.tsx` and enabled it for tenant Payments, Recovery and Platform Payments. Search and dropdown controls remain side by side, with horizontal scrolling on narrow screens. Existing filter values, query parameters and default filter-bar behavior on other pages are preserved.

Enhanced `src/features/platform/pages/PlatformPaymentsPage.tsx` with a source summary, distinct selected-source heading and count, emphasized amounts, wrapping references and manual refresh with stale-result feedback. Voucher sales, wallet top-ups and subscriptions retain separate query/schema paths and source-specific controls.

Validation: five focused tenant/admin payment-page tests passed (27 unrelated cases skipped); lint, formatting, TypeScript/production build and bundle budget checks passed. Browser and live-backend verification were not performed. No API or database changes; supplied logo retained. Next delivery: step 13, Tenant routers.


### Step 13 delivery - Tenant routers (7 September 2026)

Enhanced `src/features/routers/pages/RoutersPage.tsx` with clearer router identity, direct detail links, query-scoped counts, a single-row scrolling filter toolbar and refresh recovery that preserves loaded records. IP/location text wraps and missing last-seen data is labelled as no recorded observation. Setup/deployment badges retain authoritative values; no online/offline status is inferred from timestamps. Registration remains permission-gated and detail routes retain their existing guards.

Validation: three router-list tests passed (five unrelated cases skipped), covering filtering, staff restrictions, correct detail links and stale refresh recovery. Scoped lint, formatting, TypeScript/production build and bundle budget checks passed. Browser and live-backend verification were not performed. No API/database changes; supplied logo retained. Next delivery: step 14, Register router.


### Step 14 delivery - Register router (7 September 2026)

Enhanced `src/features/routers/pages/NewRouterPage.tsx` while retaining its existing four-step workflow. The page now has clearer setup guidance, progress styling, optional-step labels and a final review of non-secret router identity/address/location. Step navigation is disabled during submission. Per-step validation requests focus, and server errors select their affected step using current field state rather than an older form-state snapshot. Existing payload conversion, request key and credential fields remain unchanged.

Validation: two registration tests passed (seven unrelated cases skipped), covering step validation, successful creation payload/idempotency key, omission of secrets from review and a server address conflict that returns to Basics without losing entered details. Scoped lint, formatting, TypeScript/production build and bundle budget checks passed. Browser and live-backend verification were not performed. No API/database changes; supplied logo retained. Next delivery: step 15, Router details.


### Step 15 delivery - Router details (7 September 2026)

Enhanced `src/features/routers/pages/RouterDetailPage.tsx` with a clearer device overview, VPN/location fields, health observation timestamp, permission-aware refresh and independent profile/health/operation warnings. Onboarding and deployment remain separate from live reachability. Missing telemetry stays unavailable and failed health refresh stays unknown. Existing sections remain capability-filtered; tabs scroll on narrow screens. Changing router identity resets local dialogs. Edit/delete UI checks retain the existing management and deletion rules.

Validation: 19 router UI/rules tests passed, including a new failed-health-refresh case plus existing transitions, provisioning conflicts, credential paths, list restrictions and registration behavior. Scoped lint, formatting, TypeScript/production build and bundle budget checks passed. Browser and live-router verification were not performed. No API/database changes; supplied logo retained. Next delivery: step 16, Router operations.


### Step 16 delivery - Router operations (7 September 2026)

Enhanced `src/features/routers/pages/RouterOperationsPage.tsx` and the shared operation row in `components/VpnPanel.tsx`. The page now groups inline router/status/action filters, query-scoped counts, manual refresh and operation guidance. Router names link to the corresponding VPN section. Failure codes wrap, failed refreshes preserve loaded records and router-name lookup errors are independent. Existing polling of pending/running operations, status values and capability-controlled provisioning actions remain unchanged; no new retry endpoint is assumed.

Validation: 20 router UI/rules tests passed, including operation filtering, router navigation and retained failure information after refresh errors. Scoped lint, formatting, TypeScript/production build and bundle budget checks passed. Two unused Dashboard icon imports were removed to unblock the build. Browser and live-router verification were not performed. No API/database changes; supplied logo retained. Next delivery: step 17, Live sessions.


### Step 17 delivery - Live sessions (7 September 2026)

Enhanced `src/features/sessions/pages/SessionsPage.tsx` with an observation summary, explicit paused/unavailable update states, manual refresh, inline filters and query-scoped counts. Loaded sessions remain visible with a warning on refresh failure. Router-filter errors have independent retry. Connection timestamps include full date/time context; long usernames/router names wrap. Disconnect confirmation identifies the selected router and session, retains the existing acknowledgement flow and checks the disconnect capability.

Validation: three focused session tests passed (six dashboard cases skipped), covering filters, confirmed disconnect targeting, staff restrictions and manual refresh while paused with retained rows on failure. Scoped lint, formatting, TypeScript/production build and bundle budget checks passed. Browser and live-session verification were not performed. No API/database changes; supplied logo retained. Next delivery: step 18, Admin router fleet.


### Step 18 delivery - Admin router fleet (7 September 2026)

Enhanced `src/features/platform/pages/PlatformRoutersPage.tsx` with a fleet overview, operator context, query-scoped counts, inline search and four filters, and manual refresh. Long device details wrap and missing observations are explicit. Setup status is distinguished from live connectivity. Tenant-profile links remain scoped to each row; tenant-choice errors can be retried independently and failed fleet refreshes retain loaded records with a warning.

Validation: two focused fleet tests passed (21 unrelated platform cases skipped), covering tenant/setup/deployment/active filters, tenant navigation, retained records after refresh failure, and tenant-filter recovery. Scoped lint, formatting, TypeScript/production build and bundle budget checks passed. Browser and live-router verification were not performed. No API/database changes; supplied logo retained. Next delivery: step 19, Agents.


### Step 19 delivery - Agents (7 September 2026)

Enhanced `src/features/agents/pages/AgentsPage.tsx` with a reseller overview, inline filters, query-scoped counts, manual refresh and explicit stale-record warnings. Agent names are keyboard-accessible profile links, long identifiers wrap, and missing wallet balances are labelled unavailable. Currency and commission values still use the existing API fields and formatters. `components/AgentForms.tsx` now groups account, shop/contact and commission fields; edit form identity follows the selected agent. Route-level management access and existing create/edit payloads remain unchanged.

Validation: all six agent tests passed, covering filtering, profile links, missing balances, refresh failure, idempotent creation, field errors, commission serialization and approval behavior. Scoped lint, formatting, whitespace, TypeScript/production build and bundle budget checks passed. Browser and live-agent verification were not performed. No API/database changes; supplied logo retained. Next delivery: step 20, Agent details.


### Step 20 delivery - Agent details (7 September 2026)

Enhanced `src/features/agents/pages/AgentDetailPage.tsx` with reseller context, full joined timestamps, explicit missing-wallet values, separate profile/history refresh and stale-data warnings. Long usernames wrap and section tabs scroll. Local dialogs and pagination reset when the selected agent changes; confirmation rechecks allowed status transitions.

Voucher history now uses an additive exact `agent` filter in the backend VoucherFilter rather than username search. This avoids the interaction between the generic search backend and custom agent-name matching, and makes backend pagination/counts accurate. The existing tenant-scoped queryset remains authoritative.

Validation: seven agent frontend tests passed; the new backend filter test passed, including tenant isolation. Scoped lint, formatting, whitespace, TypeScript/production build and bundle budget checks passed. Browser/live-agent verification was not performed. The separate business-plan limits work remains paused pending final validation and local migration. Next delivery: step 21, Devices.


### Business-plan completion and Paystack recovery - 7 September 2026

The user resumed the business-plan work. Admin CRUD, structured public/tenant limits, purchased-term preservation and enforcement are now locally validated. The tenant subscription tracker verifies pending payments with Paystack on opening and Check now, then refreshes subscription terms on success. Backend checks: 112 passed. Relevant frontend checks: 46 passed. Scoped lint, TypeScript/build, and bundle budgets passed. Local migrations through 0005 are applied. One Paystack-confirmed pending test subscription was safely activated; unverifiable payments remain unchanged. Production deployment and browser checkout smoke test remain unverified. Next dashboard enhancement remains step 21, Devices.


### Step 21 scope - Devices

Enhance the existing MAC-device directory with the shared blue/white overview, inline search/status/plan filters, query-scoped record count, refresh with retained records on failure, plan-option retry, mobile expiry details and keyboard-accessible editing. Keep the active flag distinct from expiry and connectivity, preserve API payloads and role permissions, and reset the edit form by device identity. Validate existing registration/removal and staff restrictions plus filtering and failed-refresh recovery. The storefront verification work was paused by the user before test completion; it remains unfinished and separate from this page enhancement.


### Step 21 delivery - Devices (7 September 2026)

Enhanced the MAC-device directory with a blue/white equipment overview, inline search/status/plan filters, query-scoped counts and manual refresh. Loaded records remain visible when refresh fails; plan filters and the device form offer a retry for failed plan loading. Device names are keyboard-accessible edit buttons, long identities wrap, mobile rows retain expiry details, and edit forms reset by device ID. Existing role permissions and API payloads are preserved. Registration status is explicitly distinguished from expiry and network availability.

Validation: six focused component/schema tests passed for registration, removal, read-only staff, filter requests, retained rows and plan retry. Chromium with sample API responses passed desktop filter alignment, keyboard edit/dismissal and 390px page overflow checks. Scoped ESLint, TypeScript/production build and bundle budgets passed (134.8 kB initial JS gzip; 36.7 kB largest lazy chunk). No live device connectivity test was performed. Next delivery: step 22, General settings.


### Step 22 scope - General settings

Add the shared branded overview and section shortcuts, separate business profile from account security, show the existing storefront address and saved timestamp, preserve drafts on failed profile refresh, and clarify save/discard state. Keep slug read-only, role permissions and password behavior unchanged. Send only dirty profile fields so a refreshed server response cannot cause untouched draft fields to overwrite newer values. Validate profile patch, draft/error recovery, staff restrictions and existing password reauthentication before completing this page.


### Step 22 delivery - General settings (7 September 2026)

Enhanced General settings with the shared blue/white overview, section shortcuts, a read-only storefront link, saved timestamp and manual profile refresh. Business identity/contact editing remains permission-gated; personal account and password sections remain available to staff. Failed refreshes keep the loaded form and draft visible. The form shows unsaved/saving feedback, disables fields during submission and sends only dirty fields, preserving newer server values in untouched fields. Long storefront slugs and account identifiers wrap. Existing password reauthentication remains unchanged.

Validation: six focused schema/component tests passed, including partial PATCH, staff restrictions, password reauthentication and failed-refresh draft preservation followed by a newer server response. Eight unrelated settings cases were skipped. Chromium with sample API responses passed desktop profile/link behavior, draft preservation, 390px document overflow and keyboard section shortcuts. Scoped lint and whitespace checks passed. Live profile changes and password changes were not performed. Next delivery: step 23, Billing and payouts.

Final step 22 validation: TypeScript/production build and bundle budgets passed (134.8 kB initial JS gzip; 36.7 kB largest lazy chunk).


### Step 23 scope - Billing and payouts

Apply the shared branded overview and shortcuts; distinguish customer-payment credentials from business subscription billing; clarify write-only key fields without claiming configuration or provider validation. Add refresh recovery, retained drafts, unsaved/saving feedback and grouped credential/business-rule inputs. Preserve key replacement semantics and send only dirty fields after refetch. Validate partial patches, secret-field clearing, draft recovery and discard; run focused lint/build and browser layout checks with fixtures. No saved provider keys or live payment configuration will be changed for QA.


### Step 23 delivery - Billing and payouts (7 September 2026)

Added the branded payment-preferences overview, section shortcuts and a business-subscription link. Credential replacement and voucher/agent rules are grouped clearly; write-only key fields do not imply saved configuration or provider verification. Failed refreshes retain entered values, saves send only dirty fields, and save/discard feedback is visible. Fixed existing commission/wallet field labels by using the shared Input adornment API so labels and validation target the actual controls. Existing API payloads, key-clearing after save and role guards remain intact.

Validation: four focused billing/schema tests passed (11 unrelated settings cases skipped), including partial PATCH, replacement-key preservation on failure, protection of untouched refreshed fields and discard. Chromium with sample API responses passed draft/masking/keyboard-discard checks and final responsive/label checks at 1440, 768 and 390 pixels. Scoped lint, whitespace, TypeScript/production build and bundle budgets passed (134.8 kB initial JS gzip; 36.7 kB largest lazy chunk). No real credentials or live payment configuration were changed. Next delivery: step 24, Team settings.


### Step 24 scope - Team settings

Improve the existing membership directory with the shared overview, expandable role guide, inline role filter, query-scoped count and refresh recovery. Keep long member identities readable; retain owner-only controls and the existing last-owner guard. Clarify numeric user-ID entry, reset add-form identity by tenant and disable inputs during submission. No user search, email invitations or backend contract changes. Validate current owner workflows/read-only manager behavior, role filtering and retained records on failed refresh; check responsive and keyboard behavior.


### Step 24 delivery - Team settings (7 September 2026)

Enhanced the membership page with the shared branded overview, expandable role guide, inline role filtering, matching-member count and manual refresh. Refresh failures retain the directory and show a warning. Long member names wrap; joined dates have full timestamp tooltips. Owner-only role/removal actions and the existing last-owner guard remain in place; conflicting pending actions are disabled. The add-member form explains numeric user IDs, retains role guidance and disables fields during submission. No API changes, user search or invitation delivery were introduced.

Validation: three focused Team component tests passed (13 unrelated settings cases skipped), covering owner actions, read-only manager behavior, server errors, role filtering and retained rows on failed refresh. Chromium with sample API responses passed last-owner control, add-dialog role guidance, keyboard dismissal, refresh warning and 1440/768/390px layout checks. No real team memberships were changed. Next delivery: step 25, Subscription page enhancement.

Final step 24 validation: scoped ESLint, whitespace, TypeScript/production build and bundle budgets passed (134.8 kB initial JS gzip; 36.7 kB largest lazy chunk).

## Screenshot-led roadmap, 8 September 2026

The new dashboard request is planned in [DASHBOARD_REDESIGN_ROADMAP.md](DASHBOARD_REDESIGN_ROADMAP.md). Follow that sequence for subsequent screenshot-led work, preserving the implementation and validation history above. The previously next Subscription page is included in its phase 9. No application implementation is performed by this planning update.

Phase 1 of the screenshot-led roadmap is now implemented: light grouped sidebar, nested permitted links, pinned account controls, responsive shell and focus handling. Validation and the next step (phase 2 overview dashboards) are recorded in DASHBOARD_REDESIGN_ROADMAP.md. This preserves the prior page-level work above.

Phase 2 of the screenshot-led roadmap is implemented: tenant/platform overviews and an API-backed subscription banner. The delivery record in DASHBOARD_REDESIGN_ROADMAP.md includes 68 passing tests, five-width fixture browser checks, lint/build and bundle validation. Next: phase 3 router fleet and existing detail tools.


### Screenshot dashboard phase 3 - 8 September 2026

Completed router fleet/detail/operations presentation, setup/status filters and authoritative router allowance handling. See DASHBOARD_REDESIGN_ROADMAP.md for implementation and validation evidence. Next is phase 4, the MikroTik smart-script wizard and its backend inventory/configuration contract.
