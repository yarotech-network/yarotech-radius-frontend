# Dashboard redesign and feature roadmap

Date: 8 September 2026. Status: phases 1-3 implemented and locally verified; phases 4-12 not started.

This is the active sequence for the new screenshot-led dashboard request. Preserve the completed work and validation history in DASHBOARD_ENHANCEMENT_PLAN.md. Its previously next Subscription step is incorporated into phase 9 here. Public pages and registration remain outside this dashboard redesign.

## Audit and design decisions

The authoritative frontend is this React 19 / TypeScript / Vite application, using React Router, TanStack Query, React Hook Form, Zod, Tailwind 4, Inter and Lucide. The sibling yarotech-radius-backend is the Django/DRF API v1 backend. Do not modify the backend's duplicate frontend directory.

Existing foundations are substantial: capability-filtered workspace/platform navigation; overview pages; routers, router details and operations; Internet plans; vouchers and generation; live RADIUS sessions; payments and recovery; agents; devices; tenant settings, team and subscription; platform tenants, business plans, fleet, payments, staff and audit. Reuse these implementations and their working contracts.

The reference supplies a more cohesive composition: a roughly 260px light sidebar with independently scrolling navigation and pinned account controls, nested sections, a shallow subscription banner, consistent page headings, pale cards, compact filters and deliberate empty states. Carry these proportions and interactions into Yarotech. Retain the existing logo and blue/white/navy direction; orange reference branding, customer identities, prices and claims are not product requirements. Improve faint helper-text contrast and avoid the screenshot's clipped modal actions. Telegram remains excluded; use configured WhatsApp and guide links.

The images named admin describe a tenant owner workspace, not platform administration. Retain separate tenant, platform and agent permissions and navigation. Authentication, tenant switching, billing enforcement and existing workflows must survive the refresh.

### Repository evidence and gaps

| Area | Current evidence | Work required |
| --- | --- | --- |
| Navigation | src/app/navigation/navConfig.ts has flat groups and capability filtering | Add nested navigation, reference layout and accessible collapse behavior without changing authorization |
| Routers | src/features/routers contains list, register, detail, onboarding, VPN, secrets, RADIUS tests, checks, history and operations | Improve presentation and integrate a new configuration wizard |
| Provisioning | Backend apps/routers has NASDevice, onboarding checks, operations and WireGuard provisioning | Existing server-side VPN provisioning is not a complete RouterOS migration/script generator |
| Plans and vouchers | apps/vouchers/models.py has InternetPlan.rate_limit and fixed access-code generation | Bandwidth profile entities, PPPoE products, free-access policy, variable code length and router assignment need explicit contracts |
| Online sessions | /dashboard/live-users/ and session disconnect endpoint exist | Reuse accounting and permission checks; verify every new filter and metric is supported |
| Customer management | No standalone customer/subscriber workflow found in the inspected routes/modules | Add subscriber domain, lifecycle, imports and service assignments; do not treat payment contact records or staff accounts as subscribers |
| Analytics | Dashboard stats and RADIUS accounting exist | Add scoped historical aggregates and freshness semantics; router CPU/RAM and traffic rates need actual telemetry |
| Finance | Payments, recovery, subscriptions and platform business plans exist | Separate ISP customer revenue from ISP subscription charges; verify invoice/manual-payment contracts before adding controls |
| Support and operations | Basic public /guide exists; devices, agents and team exist | Add tenant Help Center; configure support links; define support tickets, SMS, CPE tools and asset inventory as additional workflows |

## All supplied screenshots mapped

| Reference filenames | Target / interpretation | Phase |
| --- | --- | --- |
| DASHBOARD.png; overview dashboard-admin.png | Tenant overview, shared sidebar, banner, KPIs, traffic and quick actions | 1-2 |
| admin-routers page.png | Tenant router fleet, allowances, state filters and resource availability | 3 |
| router management.png; router management1.png; router management 2.png; router management 3.png | Identity/services wizard, bridge/wireless/custom interfaces, script generation and verified completion | 4, 6 |
| plan page.png; create plan denial.png | Hotspot/PPPoE plans, bandwidth profiles, prerequisite guidance and free-access policy | 5-6 |
| customers.png; online customers.png | Subscriber records, lifecycle, import, online sessions and disconnect | 6 |
| voucher desk.png; voucher form.png | Voucher statistics, filters, list/grid, export and accessible generation dialog | 7 |
| usage analytics page.png | Accounting-based analytics and clearly labelled estimates | 8 |
| billing plans.png; invoice and billings.png | Trial/subscription summary, actual limits, plan cards, payments and invoices | 9 |
| settings.png | Branding and tenant contact/settings forms | 10 |
| help center.png; help center 1.png; help center 2.png; live support.png | Documentation cards, support CTA and floating contact panel | 11 |

## Target tenant sidebar

Implement nested navigation as capabilities become available; do not expose empty routes as working features. Preserve old route URLs or redirect them deliberately.

- Main: Overview.
- Network: Routers Management (fleet, add/link router, operations); Service Plans (Hotspot Plans, PPPoE Plans, Bandwidth Control).
- Customers & Operations: Customers (All Customers, Online Customers, CPE Tools); Services (Voucher Desk, Storefront); Agents; Assets/Devices; Support; Broadcast SMS; Usage Analytics.
- Finance: Revenue & Payments; Payment Recovery / Manual Payments where supported; Billing & Subscription / Invoices.
- System: Team; Settings; Audit Log; Help Center.

Platform navigation stays separate: Overview, Tenants, Business Plans, Router Fleet, Payments, Staff and Audit. Keep agent sales/wallet navigation intact. A shared visual shell must not grant new permissions.

## Ordered implementation phases

Each numbered phase is a reviewable deliverable. Work through its substeps one at a time. At most one phase is actively in progress. Record changed files, checks, screenshots and outstanding integration gates after each phase.

### 1. Shared dashboard shell and design system

1. Refine dashboard-scoped tokens for surfaces, borders, text contrast, spacing, shadows, radii and typography. Reuse UI primitives rather than globally overriding public/auth CSS.
2. Update AppShell, SidebarNav and navConfig: light sidebar, brand/workspace identity, grouped expandable navigation, active parent/child states and pinned profile/sign-out.
3. Preserve tenant switching, role visibility, saved collapse preferences and keyboard navigation. Provide mobile drawer with focus management, Escape/overlay dismissal and no hidden focused content.
4. Standardize page heading/actions, cards, filter bars, tables, empty/error/loading states and modal footers. Only show working notification/theme controls; a new theme needs complete contrast coverage.

Acceptance: all current workspace/platform routes remain reachable for the appropriate roles; navigation works at 1440, 1024, 768, 390 and 320px; no page overflow or trapped/clipped actions. This is the first implementation phase.

### 2. Overview dashboards and subscription banner

1. Tenant greeting, main action, optional configured community link, four summary cards, traffic panel and quick deployment actions.
2. Use authoritative subscription expiry for the banner and renewal route. Distinguish free trial, active, expired and unavailable state.
3. Adapt the same visual language to platform overview with platform-specific metrics.

Acceptance: genuine zero is distinct from missing data; no invented growth, uptime, revenue or online count. A clock is not proof that telemetry is live. Customer quick actions appear only when phase 6 is usable.

### 3. Router fleet and existing detail tools

1. Restyle /routers with search, state filters, allowance summary and Link MikroTik action.
2. Restyle /routers/:id and /routers/operations while retaining VPN, secrets permissions, RADIUS tests, checks and audit history.
3. Clearly separate pending provisioning, disconnected, stale and failed states. Show CPU/RAM/Winbox only when the backend supplies supported data and access.

Acceptance: tenant isolation, quota enforcement, operation failures/retries and secret access remain correct. Never infer CPU, RAM or online status from a lone last-seen timestamp.

### 4. MikroTik smart-script wizard: Hotspot onboarding first

1. Define a supported RouterOS/model matrix and inventory contract before generating commands.
2. Build Identity & Services -> Provisioning -> Ready UI on /routers/new, retaining existing router registration compatibility.
3. Add discovered/validated bridge, wireless and custom interface selection. Protect WAN and management uplinks; do not preselect every screenshot port. Handle existing bridges and non-ether/wlan interface names.
4. Add backend configuration intent, script generation/version, preview/diff, authorized copy/download and operation status. Reuse existing WireGuard and RADIUS services where applicable.
5. Initially support reviewed manual execution via WinBox/terminal. Display generated/awaiting connection separately from verified ready. Readiness requires actual connectivity, RADIUS and accounting checks.
6. Validate new Hotspot installation and a bounded existing-Hotspot migration in a lab. Enable only the configurations proven by this matrix. PPPoE and customer imports follow phase 6.

Acceptance: input escaping, tenant-bound access, expiry/revocation of bootstrap credentials, repeat execution without duplicate resources, recovery after partial failure, and actual client authentication/accounting verified on supported hardware. No live router is changed during planning.

### 5. Service plans and bandwidth control

1. Improve existing /plans and introduce dedicated bandwidth profiles with tenant scope and validated upload/download units.
2. Preserve existing rate_limit plans with an explicit migration/backfill strategy. Do not break them by suddenly requiring a new profile.
3. Add profile prerequisite guidance only where the new contract requires it.
4. Implement free Hotspot access as a real duration/cooldown/speed policy enforced by authentication/accounting, including abuse controls and router support.
5. Prepare service-type contracts for PPPoE; enable PPPoE plan assignment and provisioning only with phase 6.

Acceptance: existing voucher plans still work, prices/units remain accurate, unsupported free-access/PPPoE options are clearly unavailable, and policy changes reach RADIUS/router behavior.

### 6. Customers, online sessions and PPPoE migration

1. Add tenant-scoped subscriber records, identifiers, service assignments, statuses and permissions, distinct from staff users and voucher purchasers.
2. Add customer list/detail/create/edit, status filtering, import preview and validation, duplicate handling and audited lifecycle actions. Bulk deletion must respect financial/accounting retention; archive where required.
3. Extend existing /sessions with subscriber/voucher tabs, supported status filters, data totals, last successful refresh and authorized disconnect.
4. Implement PPPoE credentials/service lifecycle, renewal, suspension, RADIUS attributes and reconciliation before enabling wizard PPPoE tiles.
5. Extend migration to existing PPPoE subscribers/configuration with inventory, mapping, dry-run review and rollback. Preserve credentials securely and explicitly resolve identifier conflicts.

Acceptance: cross-tenant denials, import atomicity/partial-failure policy, payment-to-service behavior, disconnect, renewal and repeat provisioning tested. Validate a real PPPoE session and accounting in the lab.

### 7. Voucher Desk and generation

1. Restyle /vouchers with supported summary cards, filters, selection, table/grid and useful empty states.
2. Adapt /vouchers/generate into an accessible dialog or reusable form while preserving its deep link; keep actions visible on small screens.
3. Extend backend before adding optional router binding, configurable length or service-type options. Preserve unique access codes, quotas and existing generation/printing semantics.
4. Retain voucher details, export and printing, using authorized payloads and authoritative amounts.

Acceptance: filters and totals agree, generation retries cannot create accidental duplicate batches, print output remains readable and white, and assigned-router restrictions are enforced in authentication rather than display only.

### 8. Usage analytics

1. Add tenant-scoped time-window aggregates from actual accounting: traffic, active sessions, trends and subscriber expirations.
2. Define rates versus cumulative totals, timezone boundaries, counter resets, freshness and retained history.
3. Distinguish forecast/estimated recurring revenue from collected payments. Only show prior-period comparisons when both periods are available.

Acceptance: pagination cannot distort aggregate totals; missing telemetry is not zero; scheduled aggregation or polling has bounded cost and visible failures.

### 9. Finance, subscription and invoices

1. Apply the design to tenant payments/recovery and platform payments without mixing customer revenue and platform subscription charges.
2. Finish subscription presentation: real current plan, trial/expiry, usage/limits, next billing date and plan comparison cards. Preserve existing paid-plan snapshots until renewal.
3. Trace manual-payment and invoice needs to actual models. Implement authorized recording, immutable references, amounts/currency and reconciliation before adding buttons or downloadable invoices.
4. Validate Paystack renewal/upgrade, duplicate callbacks and paid-but-unfulfilled recovery. Resolve the separately deferred storefront payment-verification work before claiming the financial journey complete.

Acceptance: no reference-site prices or unsupported currencies copied; successful browser return alone never marks payment paid; invoices and entitlements follow authoritative backend state.

### 10. Settings, team, agents and assets

1. Refine general settings and billing forms; add supported logo/contact/address/WhatsApp settings with upload and URL validation where contracts are missing.
2. Preserve dirty-field edits, write-only merchant keys, final-owner protection and role restrictions.
3. Apply shell/table/form conventions to team, agents, devices and audit.
4. Define CPE tools and asset inventory separately from existing device management. Add ownership, assignment, inventory and device-action contracts before presenting these as complete.

Acceptance: tenant-specific branding and contacts persist and appear in the intended documents; no unsupported currency switch; secrets remain protected and device actions are accurately described.

### 11. Help Center, support and messaging

1. Add /help with the reference's guide-card structure, accurate Yarotech instructions and existing /guide links.
2. Add floating WhatsApp/guide support first using configured destinations. No Telegram or invented support contact details.
3. Implement web chat with a configured provider only after identity, tenant context, retention and availability behavior are defined; do not advertise agents online without provider evidence.
4. Build Support tickets if required by the sidebar: tenant tickets, messages, attachments, status and staff access.
5. Implement Broadcast SMS with provider configuration, recipients/consent, cost preview, queued delivery, rate limits, deduplication and delivery results. Reference provider names are not assumed integrations.

Acceptance: contact links work; provider outages remain understandable; unauthorized staff cannot read another tenant's support data; repeated delivery attempts do not produce uncontrolled duplicate messages.

### 12. Platform administration and final verification

1. Finish platform tenant details, business plans, router oversight, payments, staff and audit in the same visual language.
2. Review every new capability against tenant owner/member, platform staff and agent roles. Backend permissions remain authoritative.
3. Complete end-to-end onboarding, plan/customer/voucher provisioning, payment recovery, subscription renewal, support and responsive/accessibility checks.
4. Document deployment order, migrations/backfills, worker configuration, monitoring, rollback and outstanding provider/hardware verification.

Acceptance: all approved phases have implementation and validation evidence. Distinguish local checks from live provider/router proof; do not mark the roadmap complete while a required integration remains unverified.

## Smart-script implementation boundaries

Provisioning a new router and migrating an existing ISP configuration are separate workflows. A generated script alone does not establish a successful migration.

- Read-only discovery precedes migration: RouterOS version, packages, interfaces, WAN/management paths, bridges, routes, DHCP/NAT/firewall, RADIUS, existing Hotspot and PPPoE configuration.
- Capture an owner-controlled backup/export and a reviewed change list. Configuration can contain credentials; restrict access, avoid general logs and clear sensitive temporary artifacts.
- Generate only explicitly owned/approved changes with stable identifiers. No blanket reset, remove-all or silent replacement of live services. Define rollback for each supported change class.
- Protect generated credentials and downloads with tenant/object permissions, limited lifetime, no-store responses and audit events that omit secrets. Validate and escape all RouterOS input, including quotes, dollar signs and newlines.
- Keep durable operation state, locks against overlapping work, retry/idempotency rules and failure details. Do not hold database transactions across remote execution.
- Test syntax and configuration effects in a RouterOS lab, then a controlled device. Include loss of management connectivity, rerun, reboot, missing interfaces and partial execution.
- Automatic remote application is a later extension after reviewed manual application and recovery pass; migration scope and supported models must be explicit.

MikroTik documents an import dry-run option for syntax checking and Safe Mode rollback behavior, but these are not complete migration guarantees. Verify version support; Safe Mode also has a bounded change history. Sources: [Configuration Management](https://help.mikrotik.com/docs/spaces/ROS/pages/328155/Configuration%20Management) and [Scripting](https://help.mikrotik.com/docs/spaces/ROS/pages/47579229/Scripting).

## Cross-layer delivery rules

For phases introducing data or behavior, first record model/constraint/index changes, API schemas and errors, capability checks, frontend query keys/state, transaction boundaries and background jobs. Use additive migrations and compatible deployment order; backfill existing plans/subscribers deliberately. Backend deploy and migration precede UI activation. Use feature availability controls until the full workflow works.

Reuse current DRF services/viewsets, shared frontend UI and query patterns. Proposed new route names are design targets, not existing API contracts. No framework replacement, parallel mock product or unrelated cleanup.

## Validation for each implemented phase

- Run focused existing/new frontend tests: npm.cmd test -- <affected test files>; check loading, empty, failure, retry, success and permissions.
- Run npm.cmd run lint, npm.cmd run typecheck and npm.cmd run build for frontend changes; npm.cmd run size-check when bundle impact is relevant.
- For backend changes use the sibling backend's .venv/Scripts/python.exe manage.py test <affected modules>; check migrations and schema compatibility in the configured test database.
- Check affected pages at 1440/1024/768/390/320px, keyboard navigation, focus visibility, dialog scrolling, long text and touch controls.
- Distinguish fixture-based browser checks, live local API checks, real payment/email/chat/SMS provider checks and RouterOS hardware tests in every report.
- Preserve existing uncommitted work. This planning turn changes documentation only; no application test/build or hardware execution is claimed.

## Information needed at the relevant phase

These do not block phase 1. Before phase 4, establish target RouterOS versions/models, whether the first migration is Hotspot or PPPoE, and review a sanitized existing configuration. Before phase 11, obtain the actual WhatsApp destination and choose/configure chat and SMS providers. Before enabling invoices or subscriber billing, agree the business rules and required invoice fields.

## Progress ledger

Planning: complete. Phases 1-3: implemented and locally verified on 8 September 2026. Phases 4-12: not started. Earlier implementations remain available and will be improved incrementally. Next action: phase 4 MikroTik smart-script wizard, beginning with the supported inventory and configuration contract.

### Phase 1 delivery record

- Light 264px desktop sidebar, preserved 72px rail preference, scrollable grouped navigation, workspace context, pinned identity/profile and sign-out controls.
- Capability-filtered nested router, voucher and settings links; direct team, subscription and recovery destinations. Existing route URLs, tenant/platform distinction and agent navigation preserved. Future unimplemented destinations are not advertised.
- Dashboard-scoped typography, spacing, cards, focus indicators and responsive header actions; native modal header/footer remain visible while contents scroll. Public and registration designs are unaffected by the scoped styles.
- Mobile/tablet drawer: focus trap, Escape and overlay dismissal, inactive background, restored trigger focus, navigation dismissal and automatic cleanup when resizing to desktop.
- Route prefetch registry now covers every top-level and nested navigation destination, including business plans.
- Main files: src/app/navigation/navConfig.ts, prefetch.ts, src/app/shell/AppShell.tsx, SidebarNav.tsx, SidebarAccount.tsx, WorkspaceLayout.tsx, PlatformLayout.tsx, src/styles/dashboard.css, shared PageHeader.tsx and Card.tsx.

Validation:

- Focused shell/navigation suites: 16 tests passed, including staff restrictions, owner actions, nested route state, subscription highlighting, platform separation, agent tabs and collapse persistence.
- Root routing: 2 tests passed on an isolated rerun. The combined run initially timed out finding the lazy-loaded public heading under concurrent build/browser load; no public source/test change was made.
- npm.cmd run lint: passed. npm.cmd run typecheck: passed; final npm.cmd run build also includes TypeScript checking and passed.
- npm.cmd run size-check: passed; initial JavaScript 137.4 kB gzip (150 kB budget), largest lazy chunk 36.7 kB (120 kB budget).
- Chromium with synthetic API fixtures: tenant Plans and platform Tenants checked at 1440, 1024, 768, 390 and 320px; no horizontal overflow or JavaScript page errors. Verified nested drawer navigation, focus wrap/restore, collapse persistence, resize scroll unlock and sign-out clearing the refresh token for both roles.
- Inspected desktop and narrow mobile screenshots. A 320px platform page-header overflow was found and fixed by constraining action groups to available width.
- Existing third-party Zod PURE-annotation build warnings remain. No backend, database, provider or hardware changes were made; browser fixtures are not live API/provider validation.


### Phase 2 delivery record

Implemented on 8 September 2026.

- Tenant overview: personalized workspace greeting, role badge, guide/community strip, four equal summary cards, independent RADIUS session activity, quick deployment links and workspace activity/shortcuts. Guide dismissal is local to the mounted page; WhatsApp appears only for a configured HTTPS community link. No Telegram.
- The four cards show issued vouchers, active vouchers, routers with active configuration versus registered routers, and cumulative successful online payments. These are the existing API fields, not fabricated customer totals, online-router telemetry or revenue forecasts.
- Network activity uses the full API session count and the most recent returned accounting record. Upload/download values are explicitly labelled cumulative for that session only; no paginated sum is presented as total network traffic. Bandwidth history remains phase 8 work.
- Platform overview: coordinated summary cards, recent tenant activity beside operational links (including Business Plans), clear pending-payment attention and distinct voucher-sales, wallet-funding and subscription revenue cards.
- Subscription banner appears throughout authorized tenant-member workspaces, not platform administration or assigned platform-staff views. Uses /subscriptions/ status, expiry and purchased plan name. Handles trial, active, expired, cancelled, missing, loading, invalid expiry and unavailable states. Only checkout-authorized owners see renewal/plan-selection language; other members get View billing.
- Subscription reads reuse the settings query cache, refresh every minute while foregrounded, and remain disabled without permission. The countdown updates each minute and on window focus. No payment is initiated by the banner; all links use the existing billing workflow.
- Preserved independent errors/retries and cached-data warnings, paid-but-unfulfilled recovery access, existing tenant/platform roles and existing backend contracts. No database or backend changes were required.
- Phone summary cards stack below 480px to keep complete monetary amounts readable. Desktop and tablet layouts use four/two columns respectively.

Primary files: src/features/dashboard/pages/DashboardPage.tsx, components/OverviewIntro.tsx, src/features/platform/pages/PlatformOverviewPage.tsx, src/features/settings/components/SubscriptionBanner.tsx, subscriptionNotice.ts, queries.ts, AppShell.tsx, WorkspaceLayout.tsx and src/styles/dashboard.css.

Validation:

- 68 tests passed across dashboard/session, platform, subscription banner, settings and shared shell suites. Includes permission-based request suppression, missing subscription, server/client expiry, cancelled state, retry, existing settings/payment recovery, stale metrics and paginated-session semantics.
- Type checking passed. Final lint passed with no application warnings. Production build passed and includes the final phone layout rule; existing third-party Zod PURE-annotation warnings remain.
- Bundle gates passed: initial JavaScript 139.2 kB gzip / 150 kB budget; largest lazy chunk 36.7 kB / 120 kB budget.
- Chromium checks using synthetic API responses passed for tenant and platform overviews at 1440, 1024, 768, 390 and 320px. No horizontal overflow or JavaScript page errors. Reviewed desktop/platform/phone screenshots.
- Browser subscription checks passed for trial, active, expired, cancelled, unavailable and successful retry. Platform administration did not display a tenant subscription banner.
- Browser results use fixture data; they do not establish live payment, email, router or provider readiness. External integrations were not exercised or changed.


### Phase 3 delivery record - 8 September 2026

- Restyled the router fleet with a compact setup introduction, guide/operations links, authoritative subscription allowance, URL-backed quick setup filters and the existing searchable/filterable device table. Counts describe the filtered view, not fabricated fleet telemetry.
- Allowances preserve zero, finite and unlimited limits; unavailable data has retry feedback. Billing access remains capability-filtered. Router creation/deletion invalidates the subscription snapshot so allowance refreshes. Backend quota enforcement remains authoritative.
- Router details now use grouped identity/observation cells and clearer workspace section navigation. Existing permission-filtered onboarding, VPN provisioning, secrets replacement, RADIUS tests, checks and history remain intact.
- Provisioning operations now show the lifecycle, quick status filters and clearer operation rows while retaining attempt counts, failure codes, router links, polling and refresh failure handling.
- Confirmed the backend health response still returns online=null and telemetry_available=false. No fabricated online/offline, CPU, RAM or Winbox values were introduced. Smart-script generation and migration execution remain phase 4.
- Validation: 17 focused router tests passed, including access restrictions, state transitions, provisioning/secrets conflicts, RADIUS failures, allowance limits/unavailability and filter preservation. Lint and TypeScript/production build passed; existing third-party Zod annotation warnings remain.
- Chromium with isolated API fixtures: router list, details and operations passed 1440/1024/768/390/320px overflow checks (15 combinations) with no JavaScript errors. Reviewed desktop fleet and mobile details screenshots. This does not verify live router hardware or production provisioning.
