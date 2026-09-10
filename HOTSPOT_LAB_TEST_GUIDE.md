# Hotspot laboratory test guide

The fresh-install lab package is implemented, but it has not been interpreted or executed by a real RouterOS device. Keep production deployment disabled until the target passes hardware tests. Model and installed OS are selected per router; no universal hardware model is assumed.

## Current scope

- Stable RouterOS 7.16+ within the 7.x series, pinned to the exact discovered model and full version string.
- Fresh Hotspot only, with unused, unbridged Ethernet or already configured wireless interfaces. VLAN/bond client configuration and existing Hotspot migration are not executable yet.
- Read-only HTTPS discovery must be current and complete. Save the exact observed model/OS through Edit router if they differ, then rediscover.
- The router must already have a deployed management VPN, one enabled Hotspot RADIUS entry for the selected server, and the correct RADIUS secret/source address. Secrets are not included in this package. Credential bootstrap remains future work.
- A WAN interface list is required for scoped source NAT. Active FastTrack, addresses on selected clients, interface-list membership, VLAN children, PPPoE uplinks, bonds, resource collisions and addressing drift cause preflight refusal. This conservative template intentionally does not guess how to migrate those configurations.
- Select a reachable DNS server in the export form. Global firewall/DNS policy, IPv6 client isolation, wireless configuration and portal assets must be reviewed separately in the lab. The package does not install a complete custom captive portal or rewrite global security policy.

## Prepare and download

1. Open Routers Management, select the router, then Hotspot setup.
2. Discover router, confirm Use discovered interfaces, and assign only unused interfaces to Hotspot clients. Keep WAN and management protected.
3. Save a fresh-install review. A review bound to discovery expires after ten minutes; rediscover if necessary.
4. In Configuration review, use Prepare a lab installation. Enter client DNS, acknowledge the hardware validation status and generate the package.
5. Download README.txt, stage.rsc, activate.rsc and cleanup.rsc together. Store each router/package in its own local folder so generic filenames are not mixed.

An export performs no router writes and changes no readiness state. SHA-256 digests are returned by the API and recorded in audit metadata. Repeated identical exports are deterministic; changing DNS for an already exported review requires revoking that review and creating another.

## Test on the router later

Keep independent local/serial or management access and a configuration backup. Use an isolated test network. Upload the files, then run the RouterOS syntax check first:

```text
/import file-name=stage.rsc verbose=yes dry-run=yes
```

Inspect the output before importing stage.rsc without dry-run. The stage file creates a bridge, pool, client address, DHCP network/server, RADIUS-enabled Hotspot profile/server, scoped NAT and selected bridge ports. Address, DHCP, Hotspot, NAT and client ports stay disabled. Existing RADIUS entries are only checked, never changed or printed.

Inspect all generated objects, then syntax-check and import activate.rsc. Activation verifies resource ownership/properties and the addressing baseline. Client ports are enabled last. An activation error attempts to disable the package resources; interrupted execution or a failed disable still needs manual inspection.

Test all of the following and record the model, exact OS, package ID and results:

- Management/VPN access and existing WAN connectivity remain intact.
- DHCP lease and DNS resolution work on a selected client interface.
- Unauthenticated traffic is restricted to the intended captive-portal behavior.
- Valid/invalid voucher login, logout, session expiry and reconnect behave correctly.
- RADIUS authentication and start/interim/stop accounting arrive with the expected NAS identity.
- IPv6, FastTrack and other forwarding paths do not bypass the intended access policy.
- Repeated activation creates no additional objects.
- Interrupted staging can be inspected and cleaned up, then staged again.
- Cleanup removes only this package; original networking and RADIUS credentials remain intact.

Run cleanup.rsc for removal. It checks ownership before deletion and stops on modified/conflicting objects. It is not a router backup restore and cannot undo arbitrary later operator changes. If its bridge ownership marker is missing, inspect remaining objects manually. Import only one package/script at a time.

Downloaded files are offline executables: server review revocation and expiry cannot recall them. Delete obsolete copies, rediscover after changes and do not reuse a package on a different device. The dashboard will not claim ready merely because files were downloaded or manually imported.

## API and local validation

POST /api/v1/routers/:id/hotspot-setup/lab-package/ accepts expected_updated_at, intent_id, lab_acknowledged=true and dns_server. Tenant-manager scope, strict fields, router lock, current review/discovery, existing-operation exclusion and setup throttling apply. Stale/replaced reviews return 409; unsupported configurations return 400. Responses use Cache-Control: no-store. Audit stores actor, intent, generator and file digests, not credentials or file bodies. No database migration was added.

Local checks: 60 backend router tests, 31 frontend tests, scoped ESLint, TypeScript/production build and bundle budgets passed. Browser fixture checks at 1440/1024/768/390/320px passed without overflow or page errors and verified a stage.rsc download. Desktop/phone captures were inspected. Existing third-party Zod build annotation warnings remain. These checks do not validate RouterOS parsing/execution, real RADIUS traffic or hardware recovery.

Reference syntax: https://help.mikrotik.com/docs/spaces/ROS/pages/47579229/Scripting
Hotspot properties: https://help.mikrotik.com/docs/spaces/ROS/pages/56459266/HotSpot+-+Captive+portal

Next Phase 4 work remains secure credential bootstrap, supported existing-network migration, and hardware acceptance before production execution is enabled.
