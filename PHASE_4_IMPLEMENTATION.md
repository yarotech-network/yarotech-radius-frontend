# Phase 4 implementation record

Scope: extend the existing registration/detail UI with a tenant-manager Hotspot setup workspace: inventory and service intent, persisted preview, and independent verification. Existing registration and WireGuard operation contracts remain compatible.

Evidence: NASDevice stores network credentials and setup states, RouterAuditEvent stores immutable workflow records, onboarding_checks stores observations. There is no router inventory collector/client or validated Hotspot migration matrix. The health endpoint returns no live telemetry. No hardware lab is available in this session.

Implementation:
1. Add versioned, bounded inventory/configuration serializers and tenant-scoped setup GET/POST/revoke API actions. Store immutable intents in RouterAuditEvent under a router transaction lock; avoid a schema change for this review-only phase. Validate interface names, selected/protected ports, existing bridge ownership and network inputs. Reject unsupported service types and stale router versions.
2. Generate a deterministic, non-executable configuration review artifact with an unconditional guard and commented candidate commands. No NAS secrets or bootstrap credentials are included. No router or network calls occur. Fresh and existing Hotspot targets remain explicitly lab-unverified; executable export is not enabled by a UI flag.
3. Add the setup workspace to router details and an entry from /routers/new, with service selection, explicit interface roles, server preview/revocation and evidence status. Keep the legacy registration path available.
4. Test API validation, tenant isolation, staff denial, stale/busy requests, intent expiry/revocation and secret non-disclosure. Test frontend workflow and responsive sizes; run lint/type/build.

Release gates still required: actual RouterOS/model inventory, signed/verified inventory collection, full executable generator, credential bootstrap lifetime/revocation, repeat/partial execution recovery, fresh Hotspot and bounded migration lab runs with client RADIUS authentication/accounting. Do not mark Phase 4 complete until these pass. Read-only reports and review artifacts are not deployment.

Sources: https://manual.mikrotik.com/docs/authentication-authorization-accounting/hotspot-captive-portal/ ; https://help.mikrotik.com/docs/spaces/ROS/pages/328155/Configuration+Management
