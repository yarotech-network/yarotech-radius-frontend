# Phase 5 implementation record

User authorized moving to Phase 5 while Phase 4 hardware/bootstrap/migration work remains deferred. This overrides the old roadmap sequencing instruction; it does not mark Phase 4 complete.

Inspected: React/Vite plan forms/list, tenant capabilities/routes, Django InternetPlan/Voucher models and serializers, AuditedCrudMixin transactions/idempotency, voucher generation and unmanaged radcheck/radreply tables. Before this phase, InternetPlan.rate_limit was not written to a RADIUS reply by voucher issuance.

Implementation sequence:
1. Add tenant-scoped BandwidthProfile with immutable upload/download integer kbps (1..10,000,000 each), name and active flag. Add optional plan profile FK and voucher rate snapshot; preserve legacy strings and old inserts with additive nullable/defaulted columns. No automatic relinking/backfill of existing plans or vouchers.
2. Add authenticated scoped profile reads, manager audited/idempotent creates/updates, immutable speeds and protected deletion when referenced. Plans may select a profile or retain custom rate limits. Profile speeds copy into rate_limit; server rejects inconsistent explicit profile/rate combinations. Hotspot is the only accepted service_type; PPPoE/free access requests are explicitly rejected, not silently saved.
3. Only newly issued profile-backed vouchers opt into Mikrotik-Rate-Limit radreply snapshots. Transactional failure rolls back issuance. Later plan/profile changes do not rewrite issued snapshots. Remove corresponding reply on unused-voucher rename/delete/disable/expiry. Legacy vouchers remain unchanged. External FreeRADIUS tables/configuration are not created in production by Django migrations.
4. Add Bandwidth Control CRUD UI/route and nested Service Plans navigation. Refine Hotspot catalogue, profile choice and stable speed display while preserving existing custom entry, pricing, filters, authorization and vouchers. No enabled free access or PPPoE controls without actual enforcement.
5. Validate tenant/role denials, immutable/inactive/protected profiles, backward compatibility, profile selection, RADIUS snapshot/rollback/cleanup, React forms, routes and navigation. Run focused/broader tests, migration SQL/plan, local migration, lint/type/build and multi-width browser checks.

Free duration/cooldown policies and PPPoE remain unavailable: abuse-resistant authentication/accounting plus router enforcement are not implemented. This phase delivers plans and bandwidth first; do not claim the whole Phase 5 acceptance gate is complete. Real RADIUS/router rate enforcement and production rollout remain unverified until the later lab session.

## Delivery - 9 September 2026

Core plans and bandwidth work is implemented. This is not completion of every Phase 5 acceptance gate.

- Service Plans now contains Hotspot Plans (`/plans`) and Bandwidth Control (`/plans/bandwidth`). The profile catalogue supports search, status filtering, pagination, create, rename, deactivate and protected delete. Staff retain read-only access.
- Plan forms can select a tenant bandwidth profile or preserve custom speed entry. Existing prices, filters, plan URLs and legacy rate strings remain supported. Profile speeds are immutable; create another profile for a new speed tier.
- The tenant-scoped `/api/v1/bandwidth-profiles/` API validates integer kbps, permissions, inactive assignments and linked-profile deletion. Explicit inconsistent profile/rate pairs are rejected. Older clients changing a custom rate detach the profile.
- Newly issued vouchers whose plan matches its selected profile save a speed snapshot and transactional Mikrotik-Rate-Limit reply. Issuance failure rolls back credentials and voucher changes. Snapshot cleanup covers disable/expiry and unused-voucher rename/delete without deleting unrelated reply attributes. Existing vouchers are not rewritten; legacy custom issuance retains its prior behavior.
- Free-access enforcement is visibly unavailable. PPPoE is deferred to Phase 6. Unsupported service/free-access requests are rejected rather than silently accepted.

## Validation completed

- Backend: 106 tests passed across vouchers, payments, agents and core, including new tenant/role isolation, profile lifecycle, backward compatibility, RADIUS snapshot, rollback and cleanup cases.
- Frontend: 28 focused tests passed across plans, shell responsiveness and navigation prefetch. The five bandwidth tests passed again after final dialog and accessibility changes.
- Scoped ESLint, TypeScript, production build and bundle budget checks passed. Initial JavaScript: 139.5 kB gzip against 150 kB; largest lazy chunk: 36.7 kB against 120 kB.
- Fixture-based Chromium checks passed for four page/form states at 1440, 1024, 768, 390 and 320px: 20 combinations, no horizontal overflow or JavaScript page errors. Profile creation and plan assignment submissions were checked, including 1.001 Mbps to 1001 kbps and NGN 50.50 to 5050 minor units. Desktop catalogue and mobile form screenshots were visually inspected.
- OpenAPI validation: zero errors; one existing agent access-code type-hint warning remains. Existing dependency PURE-annotation build warnings remain.
- Migration drift check: no changes detected. Migration SQL and plan were inspected. Local PostgreSQL already reports vouchers.0003_bandwidth_profiles applied; the migration command had no migrations to apply. Six legacy plans and 247 legacy vouchers retained null profiles/empty snapshots. No production migration or hardware execution was performed.

## Deployment and remaining gates

Apply the additive backend migration before deploying code that reads the new columns. It adds nullable plan profile linkage, a profile table and a voucher snapshot with a database default for older writers. Check production DDL locking and backup/restore procedures in that environment; local PostgreSQL validation does not establish production rollout safety. Django does not create the external FreeRADIUS tables in production.

Keep snapshot data and reply-cleanup behavior when rolling back after profile-backed vouchers have been issued; do not drop the schema or revert to cleanup code that leaves speed replies behind. Prefer a forward fix. Existing voucher speed snapshots do not freeze every plan attribute: price/duration and other plan relationships still require review when editing a plan.

Still pending: configured FreeRADIUS SQL consumption and speed enforcement on a real router, the Phase 4 hardware/bootstrap/migration gates, production deployment verification, and free-access duration/cooldown/abuse policy with router enforcement. PPPoE belongs to Phase 6. The user authorized moving to Phase 5 while Phase 4 remains deferred.

Vendor contract reference: https://help.mikrotik.com/docs/spaces/ROS/pages/328097/RADIUS
