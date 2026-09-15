# IoT / MAC device interface

The existing /devices directory is now the IoT / MAC Devices workflow. The user explicitly confirmed replacing the PPPoE navigation and customer-detail service panel while retaining PPPoE records. Existing PPPoE source/API routes remain available for compatibility; no subscriber records were deleted or converted into MAC devices.

## Implemented
- Directory: device, MAC, router/site, registration status, plan, expiry, session, usage and actions; tenant-scoped name/MAC search, router/status/plan filters and pagination.
- Add/edit form: device name, normalized MAC, router, plan, permanent or time-limited access, optional VLAN ID 1-4094, description and enabled state. All four reference MAC formats are accepted.
- Existing API /api/v1/iot-devices/ gains router, access_type, vlan_id and description. Permanent access uses null expiry. Legacy records retain timed access and may remain unassigned until edited.
- Additive migration iot_devices.0002 applied to local PostgreSQL. It does not configure a router, WireGuard or RADIUS.

## Accounting and remaining integration boundary
Session and usage summaries read recorded MAC-as-username RADIUS accounting, matched to the device's assigned router and tenant-owned NAS addresses. An open accounting record is not proof of current connectivity. Missing accounting is displayed as unavailable or not observed.

MAC registration stores access policy; it does not provision MAC authentication on a router. Actual router/RADIUS enforcement and collection require separate integration and physical lab validation. The customer Internet users history discussed earlier is separate from this registration directory.

## Verification
- Six backend tests passed, including tenant/router isolation, policy validation and actual PostgreSQL accounting aggregation.
- Twenty-three frontend tests passed across devices, customers and shell responsiveness.
- TypeScript and production build passed; targeted ESLint passed.
- Chromium fixture-based directory, permanent form and timed form checks passed at widths 1440, 768, 390 and 320, without horizontal overflow or page errors.
- Local PostgreSQL migration applied; migration drift check and diff whitespace check passed.
- Real CHR authentication, traffic collection and production deployment were not tested. Browser checks used API fixtures.
