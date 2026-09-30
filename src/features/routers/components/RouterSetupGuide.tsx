import { Link } from 'react-router';

export function RouterSetupGuide({ canManage }: { canManage: boolean }) {
  return (
    <section
      aria-labelledby="router-setup-guide-title"
      className="rounded-card border border-border bg-surface p-5 sm:p-6"
    >
      <div className="max-w-3xl">
        <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
          Router onboarding
        </p>
        <h2 id="router-setup-guide-title" className="mt-1 text-xl font-semibold text-ink-900">
          Set up a MikroTik HotSpot router
        </h2>
        <p className="mt-2 text-sm text-ink-600">
          Check the router in WinBox, create its own record here, then verify a real test login. Use
          a separate setup file for each physical router.
        </p>
      </div>

      <ol className="mt-5 grid gap-4 lg:grid-cols-3">
        <li className="rounded-card border border-border bg-surface-muted p-4">
          <h3 className="font-semibold text-ink-900">1. Before you add it</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-700">
            <li>
              Connect through a management port. In WinBox, check the model and RouterOS version in{' '}
              <strong>System → Resources</strong>. Automatic HotSpot setup needs RouterOS 7.17 or
              newer stable 7.x.
            </li>
            <li>
              In <strong>Interfaces</strong> and <strong>Bridge → Ports</strong>, identify WAN,
              management and the customer-facing interface. Choose the bridge if customer ports
              belong to one.
            </li>
            <li>
              Check WAN Internet in <strong>IP → DHCP Client</strong> and{' '}
              <strong>IP → Routes</strong>. Review the customer subnet, DHCP, HotSpot and NAT in
              their <strong>IP</strong> menus; record exact names if you will reuse them.
            </li>
            <li>
              Check <strong>System → Device Mode</strong> permits HotSpot. Save a password-protected
              backup, download it from <strong>Files</strong> and keep management access available.
            </li>
          </ul>
        </li>

        <li className="rounded-card border border-border bg-surface-muted p-4">
          <h3 className="font-semibold text-ink-900">2. Create it in Yarotech</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-700">
            <li>
              Open <strong>Routers → Add router</strong> in the intended tenant and environment.
              Enter a name and the exact customer-facing HotSpot interface.
            </li>
            <li>
              For a new HotSpot, enter the reviewed LAN gateway/subnet and choose whether to create
              or reuse DHCP. Keep existing NAT if WinBox already shows suitable WAN masquerade.
            </li>
            <li>
              Confirm the network details and create the router once. Wait for{' '}
              <strong>Setup → Ready</strong>; if preparation needs attention, fix the cause and
              retry on the same router.
            </li>
            <li>
              Download only this router's private <strong>.rsc</strong> file from its Setup tab.
              With WinBox <strong>Safe Mode</strong> on, upload it in <strong>Files</strong> and use
              the one import instruction shown on that tab in <strong>New Terminal</strong>.
            </li>
          </ul>
          {canManage ? (
            <Link
              to="/routers/new"
              className="dashboard-data-link mt-4 inline-flex rounded-md px-1 py-1 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Add router
            </Link>
          ) : (
            <p className="mt-4 text-sm text-ink-600">
              Ask an owner or router manager to create the router.
            </p>
          )}
        </li>

        <li className="rounded-card border border-border bg-surface-muted p-4">
          <h3 className="font-semibold text-ink-900">3. After import</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-700">
            <li>
              In WinBox <strong>WireGuard → Peers</strong>, confirm a recent handshake. Check the
              intended server in <strong>Radius</strong> and an enabled server on the correct
              interface in <strong>IP → Hotspot</strong>.
            </li>
            <li>
              Connect an owned device to the customer network. Verify DHCP, portal access, a valid
              test voucher, Internet access and a HotSpot active session.
            </li>
            <li>
              Back in the router's Yarotech page, check onboarding, RADIUS/accounting results and
              last seen. <strong>Unknown</strong> is not confirmed offline; a VPN handshake alone
              does not prove voucher login.
            </li>
          </ul>
        </li>
      </ol>

      <p className="mt-5 rounded-card border border-border bg-surface-muted p-4 text-sm text-ink-700">
        <strong>Staging and production are separate.</strong> Each needs its own router
        registration, tunnel identity and setup file. Test in staging first; moving the same
        physical router to production requires a planned cutover and a new production setup file.
      </p>
    </section>
  );
}
