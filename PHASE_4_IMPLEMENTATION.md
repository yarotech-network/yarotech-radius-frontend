# Phase 4 implementation record

Scope: extend the existing registration/detail UI with a tenant-manager Hotspot setup workspace: inventory and service intent, persisted preview, and independent verification. Existing registration and WireGuard operation contracts remain compatible.

Evidence: NASDevice stores network credentials and setup states, RouterAuditEvent stores immutable workflow records, onboarding_checks stores observations. At the start of this phase there was no router inventory collector/client. The read-only collector is now implemented below; a validated Hotspot migration matrix remains outstanding. The health endpoint returns no live telemetry. No hardware lab is available in this session.

Implementation:
1. Add versioned, bounded inventory/configuration serializers and tenant-scoped setup GET/POST/revoke API actions. Store immutable intents in RouterAuditEvent under a router transaction lock; avoid a schema change for this review-only phase. Validate interface names, selected/protected ports, existing bridge ownership and network inputs. Reject unsupported service types and stale router versions.
2. Generate a deterministic, non-executable configuration review artifact with an unconditional guard and commented candidate commands. No NAS secrets or bootstrap credentials are included. No router or network calls occur. Fresh and existing Hotspot targets remain explicitly lab-unverified; executable export is not enabled by a UI flag.
3. Add the setup workspace to router details and an entry from /routers/new, with service selection, explicit interface roles, server preview/revocation and evidence status. Keep the legacy registration path available.
4. Test API validation, tenant isolation, staff denial, stale/busy requests, intent expiry/revocation and secret non-disclosure. Test frontend workflow and responsive sizes; run lint/type/build.

Release gates still required: actual RouterOS/model inventory, signed/verified inventory collection, full executable generator, credential bootstrap lifetime/revocation, repeat/partial execution recovery, fresh Hotspot and bounded migration lab runs with client RADIUS authentication/accounting. Do not mark Phase 4 complete until these pass. Read-only reports and review artifacts are not deployment.

Sources: https://manual.mikrotik.com/docs/authentication-authorization-accounting/hotspot-captive-portal/ ; https://help.mikrotik.com/docs/spaces/ROS/pages/328155/Configuration+Management

## Validation completed on 8 September 2026

- Backend: `venv/Scripts/python.exe manage.py test apps.routers --noinput` passed all 36 tests against the local PostgreSQL test database, including 10 new setup tests. Django system checks passed. No application schema migration was required.
- Frontend: 22 tests passed across HotspotSetupPanel.test.tsx, routers.test.tsx and routerFleet.test.tsx. Includes saved review/revocation, inventory choices, version submission, unavailable API, existing registration/management and allowance behavior.
- Full lint and final router-scoped lint passed. TypeScript and production build passed; existing third-party Zod PURE annotation warnings remain.
- Bundle budgets passed: initial JavaScript 139.3 kB gzip (150 kB limit), largest lazy chunk 36.7 kB (120 kB limit).
- Chromium with isolated API fixtures: all three setup screens checked at 1440, 1024, 768, 390 and 320px; no page overflow or JavaScript errors. Revoking a review removed download controls. Inspected rendered desktop inventory and mobile review screenshots. Browser tests do not establish a live frontend/backend/hardware deployment.

## Current continuation point

The user clarified that each ISP user specifies the model and installed RouterOS version when creating a router. Do not require one global model/version from the product owner. Persist this per-router profile; automatic discovery must later confirm it and select a versioned generator by model, OS and installed features. Validate supported combinations in a lab before enabling executable export. Do not describe the present non-executable review artifact as a smart migration script or completed Phase 4.


## Per-router target clarification - 8 September 2026

- Router creation now accepts a free-text exact MikroTik model and installed RouterOS version. Both are required in the UI when continuing to Hotspot review; legacy registration/API callers can omit them.
- Added NASDevice.model and NASDevice.routeros_version and migration 0005_router_hardware_profile. These are additive non-null text columns with empty database defaults, preserving old rows and older writers. SQL inspected; migration is marked applied in the local database. Deploy this expansion before backend code that selects the columns. Do not roll it back after collecting profiles without preserving the new values.
- The API returns the persisted profile and current compatibility status per router. Blank targets are incomplete, RouterOS 7 targets are unverified, and other versions are unsupported by the current review generator. This is not a claim that every RouterOS 7/model combination can execute a script.
- Hotspot setup pre-fills the individual router profile and clearly flags unsupported review versions. Actual executable generator selection remains future Phase 4 work; no global single-target assumption should block its design.
- Validation for the per-router profile update: 12 backend setup tests and 17 frontend router/setup tests passed. TypeScript/build, scoped lint and bundle budgets passed. Browser fixture checks for the creation fields at 1440/390/320px found no overflow or JavaScript errors. Existing Zod build annotation warnings remain. Migration 0005 is marked applied locally; production deployment/hardware execution were not tested.

## Discovery and compatibility implementation plan

Implement a bounded RouterOS REST HTTPS collector behind a manager-only POST discovery action. The only destination is the assigned, deployed WireGuard IPv4 peer in WG_MANAGED_SUBNET; no browser-supplied URLs, ports or credentials. Use stored encrypted RouterOS credentials, certificate verification, no environment proxies, no redirects, whitelisted GET paths/properties, response/row/string limits and a collection deadline. Configuration supports a server-owned custom CA bundle for private certificates.

Collect model/version/architecture, interfaces, packages, bridge membership, addresses, interface lists, default routes, DHCP clients, VLAN/bond dependencies, existing Hotspots and device-mode where accessible. Persist only normalized allowlisted fields in immutable router audit snapshots. Separate current, stale, changed, partial and failed discovery. Run network reads outside transactions; lock and recheck router version/busy state before committing; reject older concurrent results. No schema change, new dependency, provisioning write or bootstrap credential is involved.

Compatibility evaluates observed OS, declared/observed mismatch, interface topology/protected uplinks, incomplete observations and Hotspot restrictions. No validated executable profiles exist yet: successful discovery must not produce an executable/ready claim. Managers explicitly load discovered interfaces into the draft, replacing unsaved inventory only on confirmation. No client ports are selected automatically. Reviews tied to discovery must reference the latest fresh snapshot, match observed model/version and preserve protected interfaces; manual reviews remain labelled manual.

Tests: transport TLS/redirect/destination/body bounds, normalization/protection and compatibility; tenant/role restrictions, stale/busy/out-of-order snapshots and failure preservation; UI discovery success/failure, explicit adoption, and existing registration/review behavior. Finish with lint/type/build and responsive checks. Real device discovery requires a reachable VPN peer, RouterOS HTTPS service, credentials and trusted certificate; this session will use transport/API/browser fixtures unless an authorized lab is supplied.


## Discovery delivered - 8 September 2026

- Added manager-only POST /api/v1/routers/:id/hotspot-setup/discover/. Uses stored credentials and the assigned deployed WireGuard peer, restricted by an administrator allowlist. HTTPS certificate verification is mandatory; redirects and environment proxies are disabled. Bounded, allowlisted GET reads collect model, OS, interfaces, bridge membership, packages and Hotspot/device-mode observations.
- Immutable inventory snapshots expire after ten minutes. Router changes, newer discoveries and expired snapshots invalidate dependent reviews. The server protects discovered WAN/management interfaces and rejects conflicting inventory. Discovery does not change the router.
- The UI shows observed compatibility and blockers. Loading discovered interfaces requires confirmation and preserves the draft until accepted; no client ports are selected automatically. Model and RouterOS declarations can also be corrected through Edit router before rediscovery.
- Validation: all 52 backend router tests and 26 focused frontend tests passed. Scoped ESLint, TypeScript/production build and bundle budgets passed. Existing third-party Zod annotation warnings remain. Fixture browser checks passed at 1440/1024/768/390/320px without overflow or JavaScript errors; desktop and mobile captures inspected.
- Deployment prerequisites and configuration are documented in the backend docs/ROUTER_DISCOVERY.md. No real router was contacted. Actual VPN reachability, HTTPS credentials/certificates and hardware compatibility remain unverified.
- Phase 4 remains open. Next: implement a versioned executable Hotspot generator against fresh observed inventory, secure bootstrap, preflight and partial/repeat execution recovery, then validate supported fresh-install and migration targets in a hardware lab with RADIUS authentication/accounting. Execution remains disabled until those gates pass.

## Next implementation: executable laboratory package

Implement a deterministic, secret-free fresh-Hotspot package (stage, activate, cleanup) for a current discovery-bound review. Each package pins exact observed model/RouterOS (stable 7.16+), management IP and selected unbridged Ethernet/wireless interfaces. Runtime preflight fails before writes for identity, topology, naming, addressing, RADIUS and feature conflicts. Stage creates disabled services/ports/address/NAT; activation is separate. Cleanup deletes only exact package-owned resources, in dependency order. Repeat staging fails closed instead of duplicating configuration. Failed activation disables package services; interrupted staging can be cleaned up explicitly. Never reset a router, change existing bridges or print credentials.

Add manager-only, throttled POST hotspot-setup/lab-package with strict expected router version, current intent ID and explicit lab acknowledgement. Lock the router and revalidate current review/discovery; audit metadata only. Repeated export reuses its deterministic audit record. No new schema, automatic router writes, bootstrap tokens or readiness transitions. UI exports individual files from an explicit lab section, clears obsolete package state on review replacement/revocation, and explains that downloaded files cannot be recalled. Existing migration remains review-only.

Validate generator structure and rejection conditions, tenant/role boundaries, expired/revoked/superseded snapshots, repeat export, secret exclusion, frontend requests/error handling, type/build/lint and responsive UI. RouterOS interpretation, real RADIUS traffic and recovery on hardware will be tested later by the user. Secure credential bootstrap and existing-network migration remain future work, not implicit guarantees of this lab package.

## Fresh-install laboratory generator delivered

Implemented hotspot-lab-fresh-v1 with manager-only POST hotspot-setup/lab-package and an explicit UI export section. Exports stage, activate, cleanup and README artifacts, pinned to a current discovery-bound review and exact observed model/OS. Supports stable RouterOS 7.16+ and unused Ethernet/wireless client interfaces. Runtime checks protect management, detect addressing/resource conflicts and require existing RADIUS setup. Stage keeps service resources disabled; activation enables client ports last and attempts disable on errors; cleanup checks ownership and preserves unowned resources. Offline exports cannot be remotely revoked. No credential bootstrap, automatic router writes, schema change or readiness transition occurs.

Validation: 60 router backend tests, 31 frontend tests, scoped lint, TypeScript/build and bundle budgets passed. Five fixture browser widths (1440/1024/768/390/320px) passed overflow/page-error checks and file download. Desktop/mobile visuals inspected. RouterOS syntax/execution and real hardware remain NOT VERIFIED. Existing Zod annotation warnings remain.

See HOTSPOT_LAB_TEST_GUIDE.md for exact scope, runtime prerequisites, later hardware tests and limitations. Phase 4 is still open for credential bootstrap, existing-network migration and hardware acceptance. This supersedes the earlier statement that no executable artifact exists: lab exports now exist; production execution remains disabled.
