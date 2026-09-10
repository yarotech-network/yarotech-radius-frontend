# Phase 6 - customers, sessions and PPPoE

## Current step: customer directory (6A)
The user asked to proceed after Phase 5. The roadmap starts Phase 6 with subscriber records and customer management. Inspection found only voucher purchaser contact fields and staff accounts; neither is a subscriber identity. Start with a complete directory workflow before enabling service provisioning.

Deliver tenant-scoped customer reference/name/contact/address/notes; current or archived record state; paginated search/status filters; create/detail/edit; audited archive/restore instead of hard deletion; and CSV preview plus atomic confirmed import. Every record initially has no service assigned. Record status must not imply network access. No passwords, payment claims, or fabricated session associations.

Backend: new customers Django app and additive table with tenant/reference uniqueness, serializer allowlist and bounded fields. Tenant members can read; owner/manager can write. Platform staff/agents have no implicit access. Serialize writes under the tenant row lock, enforce uniqueness in the database, and commit mutations with audit. Create/import support existing idempotency handling. Import accepts at most 200 rows/256 KiB, rejects invalid or duplicate rows, requires a signed tenant/actor/content-bound 15-minute preview token, and revalidates at commit. No partial import. No CSV personal data in audit metadata.

Frontend: Customers navigation and route guarded by customer capabilities; existing session route retained. Reuse query client, dialogs, inputs, pagination and error handling. Reset page on filter changes, disable/dismiss-lock pending dialogs, show errors and retry, invalidate after successful writes. Detail view explicitly shows no assigned service.

Validation: tenant and role denials; case-insensitive duplicates; archive retention; import bounds, token tampering/expiry, duplicate revalidation, replay and rollback; frontend create/edit/archive/import/error flows; route coverage; lint/type/build; fixture browser checks at five widths. Deploy additive migration before app code; no old tables or legacy data rewritten. Production migration remains separately verified.

Remaining Phase 6 steps: subscriber service assignments, PPPoE credentials/renewal/suspension/RADIUS reconciliation, service-aware sessions, payment-to-service contract and bounded existing-router migration. Keep wizard PPPoE unavailable until these behaviors and the hardware gates pass. This directory delivery does not complete Phase 6.

## 6A delivery - 9 September 2026

Implemented `/customers` with read-only staff access and owner/manager create/edit/archive/restore, separate detail fetching, contact fields, search/status filtering and paginated cards. CSV file/paste preview and confirmation are wired to the real API. The sidebar includes Customers; the existing Live sessions route is retained. No existing purchaser/staff records were converted.

Backend endpoints: GET/POST `/api/v1/customers/`, GET/PUT/PATCH `/api/v1/customers/{id}/`, POST archive/restore on the detail resource, POST `/api/v1/customers/import-preview/` and `/api/v1/customers/import-confirm/`. Hard deletion is disallowed. Reference uniqueness includes archived records and is case-insensitive. References are immutable after creation. Import preview returns row-specific errors without writing; confirm revalidates under the tenant lock and commits all records/audits together. Signed preview tokens bind actor, tenant and exact CSV for 15 minutes. Existing idempotency storage handles create/import retry; the UI rotates keys when input changes and retains keys for retries of the same input.

Validation completed:
- 84 backend tests passed across customers, vouchers, dashboard and core, including eight new customer tests covering cross-tenant access, roles, database uniqueness, archive retention, unknown-field rejection, import validation/replay, token binding/expiry and rollback after an audit failure.
- Five customer frontend tests passed after fixing stable accessible field names when validation appears. Sixteen shell/navigation tests passed in the broader run.
- Scoped ESLint, TypeScript, production build and size checks passed. Initial JS 139.6 kB gzip / 150 kB budget; largest lazy chunk 36.7 kB / 120 kB.
- Chromium fixture checks passed for list/detail/create/import-preview at 1440, 1024, 768, 390 and 320px (20 combinations), with no horizontal overflow or page errors. Create and confirmed-import payloads were checked. Visual inspection caught a collapsed desktop search field; it was fixed with a bounded filter grid and a minimum-width browser assertion. Desktop and mobile screenshots were inspected.
- OpenAPI validation: zero errors, one pre-existing agent access-code type-hint warning. Existing Zod build annotation warnings remain. Migration drift check passed; PostgreSQL SQL was inspected. Local customers.0001_initial migration applied successfully after a local-host check; inherited DEBUG=release was overridden for this command only.

Rollout: apply the new customers migration before backend/frontend deployment. The migration creates a new table/indexes and references the tenant table; no legacy row backfill or table rewrite. Production lock timing, deployment and load/concurrent execution remain unverified. Keep customer data when rolling code back; do not reverse/drop the table after customer records are created. Real-router behavior was not exercised, and this step sends no provisioning commands.

Next action: Phase 6B, define and implement subscriber service assignments and PPPoE lifecycle (credentials, expiry/renewal, suspension, RADIUS consistency and reconciliation), then extend sessions and migration. Payment-to-service rules and hardware validation remain gates. Do not mark Phase 6 complete or enable PPPoE wizard tiles based on the directory alone.

## 6B implementation plan

Use separate PPPoE plans and one retained service per customer. Plans contain immutable duration, price and bandwidth selection; issuance snapshots rate and period. Service router/username are fixed; password is write-only and stored with Django password hashing. No passwords in audit or idempotency responses. Creates and versioned renew/suspend/resume/password changes use transactions and existing idempotency, with mandatory keys for additive renewal. Renew extends from max(now, expiry) and never implicitly resumes a suspension. No payment is recorded by manual renewal.

Use a dedicated, token-authenticated PAP-only RADIUS decision endpoint. It verifies hashed passwords, assigned router source address without ambiguous NAS ownership, PPP service type/protocol, active tenant/customer/router, expiry and suspension. Returns bounded Session-Timeout and snapshot speed; no SQL credentials, no fallback to voucher authorization for reserved yrp- usernames. API/database outage must reject. Supply FreeRADIUS 3 configuration template; no live configuration changes. CHAP/MS-CHAP and router PPPoE wizard remain unavailable.

Suspension/password change commits a disconnect cutoff. A bounded maintenance command reconciles authoritative state with accounting, attempts CoA for old sessions only and records pending/acknowledged/failed state without claiming a stopped session on ACK. Leased scans avoid overlapping workers, expire after crashes, and preserve a newer cutoff on concurrent mutations. No external network calls inside mutation transactions. Expiry is enforced per authentication and Session-Timeout, with reconciliation as cleanup. Customer archiving is blocked while its service is enabled.

Frontend: PPPoE plans page and customer service panel with assign, renew, suspend, resume and password replacement. Read-only staff; manager actions. Show configured/expired/suspended and accounting cleanup separately, not fake online state. Additive migrations before code; existing vouchers/payments stay separate. Validate tenant denials, credentials absent from responses/storage audits, renewal retries/stale versions, auth rejection matrix, worker retry/cutoff behavior, CRUD/forms and responsive views. Real FreeRADIUS/RouterOS and payment-to-service automation remain separate unverified gates.

## 6B delivery - 9 September 2026

Implemented the application-side PAP service lifecycle:
- Separate PPPoE plans at `/plans/pppoe`, with active bandwidth selection, immutable commercial terms, price in NGN minor units, pagination/search and activation/deactivation.
- Customer detail service assignment, generated username, hashed/write-only password, immutable router/plan assignment, expiry/rate snapshots, versioned renew/suspend/resume/password replacement. One retained service per customer. Archive requires suspension.
- Dedicated private `/api/v1/radius/pppoe/decision/` endpoint verifies PAP credentials and PPP attributes against authoritative customer/tenant/router/suspension/expiry state. It rejects unconfigured or invalid tokens and ambiguous/wrong router sources. Reply values disable expansion. No PPPoE passwords are written to RADIUS SQL tables.
- Hourly maximum Session-Timeout, or remaining expiry if shorter, requires client reconnect/reauthentication. Manual renewal does not record or collect a payment and never silently resumes a suspended service.
- Leased, bounded `reconcile_pppoe_services` maintenance command checks old accounting sessions and attempts CoA outside mutation transactions. ACK and stop-accounting remain distinct. Failed items persist for retry, expired leases recover after crashes, and a newer service version retains pending cleanup. The maintenance unit includes the command; no installed service was changed.
- Dedicated member PPPoE capabilities preserve platform-staff/agent boundaries. Existing Hotspot voucher APIs and paid checkout remain separate; new manual voucher usernames cannot use the subscriber prefix.

Validation:
- 94 backend tests passed across customers, vouchers, dashboard and core, including ten new PPPoE tests for password storage/replay, role/tenant denials, renewal version/idempotency, archive/suspension, PAP scope/expiry/snapshots, token configuration, password rotation, immutable plans, leased accounting cleanup and worker failure recovery.
- 37 frontend tests passed across customers, plans, shell and navigation. Nine customer/service tests passed again after final UI cleanup.
- Browser fixtures: PPPoE list, plan form, assignment and service panel checked at 1440/1024/768/390/320px (20 combinations). No horizontal overflow or page errors; exact price conversion, assignment payload and renewal version checked. Desktop and mobile screenshots inspected. This did not use live network authentication.
- OpenAPI validation: zero errors, one existing agent serializer type-hint warning. Migration drift check passed; PostgreSQL SQL inspected. Local customers.0002_pppoeplan_pppoeservice_and_more applied successfully after verifying local database host. No production migration performed.
- TypeScript/build, scoped ESLint and bundle budgets checked. Existing Zod annotation warnings remain. Initial JS stays below the 150 kB gzip budget (139.9 kB on the final checked build), largest lazy chunk 36.7 kB / 120 kB.

Integration guide and FreeRADIUS 3.2 module template: sibling backend `deploy/freeradius/pppoe/README.md` and `yarotech_pppoe.conf`. Configure the dedicated token/private endpoint and validate the virtual-server template with `freeradius -XC` before enabling network access. Router PPPoE wizard/migration remains disabled. The template targets PAP and IPv4 NAS transport; CHAP/MS-CHAP, IPv6 transport, actual FreeRADIUS parsing/authentication, hardware speed/expiry enforcement, CoA transport and production load are NOT VERIFIED. Do not label this production-ready based on local tests.

Next: Phase 6C service-aware online sessions and bounded existing-PPPoE migration planning/implementation. Payment-to-service automation needs its own contract. Preserve Phase 4 hardware gates and Phase 5 free-access enforcement as open work. Deploy the additive schema before code, retain service data on rollback, and keep reserved-prefix authentication fail-closed if disabling the REST integration.
