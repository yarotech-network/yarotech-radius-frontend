import { Link, useLocation } from 'react-router';
import { CircleCheckBig, ClipboardList, Terminal } from 'lucide-react';
import { DeploymentGuide } from './guide/DeploymentGuide';

const STEPS = [
  {
    icon: ClipboardList,
    title: 'Add the router',
    text: 'Give it a name, choose the port customers connect to, and pick a customer network. Three short steps, no technical setup.',
  },
  {
    icon: Terminal,
    title: 'Paste one command',
    text: 'Copy the install command from the router’s Setup tab into WinBox → New Terminal. It sets up the VPN, RADIUS and HotSpot in about a minute.',
  },
  {
    icon: CircleCheckBig,
    title: 'Log in with a test voucher',
    text: 'Connect a phone to the customer Wi-Fi and log in. The Setup tab turns green as each check passes.',
  },
] as const;

/** Short overview of router onboarding; the detailed, state-aware guide lives on each router's Setup tab. */
export function RouterSetupGuide({ canManage }: { canManage: boolean }) {
  const location = useLocation();
  return (
    <section
      aria-labelledby="router-setup-guide-title"
      className="rounded-card border border-border bg-surface p-5 sm:p-6"
    >
      <p className="text-xs font-semibold tracking-wide text-brand-700 uppercase">
        How onboarding works
      </p>
      <h2 id="router-setup-guide-title" className="mt-1 text-xl font-semibold text-ink-900">
        Set up a MikroTik HotSpot router
      </h2>
      <p className="mt-1 text-sm text-ink-600">
        You need a MikroTik router on RouterOS 7.17 or newer with internet, and WinBox on a
        computer.
      </p>
      <ol className="mt-5 grid gap-3 md:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <li
            key={title}
            className="flex gap-3 rounded-card border border-border bg-surface-muted p-4"
          >
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700"
            >
              <Icon className="size-4.5" />
            </span>
            <div>
              <h3 className="text-sm font-semibold text-ink-900">
                {index + 1}. {title}
              </h3>
              <p className="mt-1 text-sm text-ink-600">{text}</p>
            </div>
          </li>
        ))}
      </ol>
      <section
        aria-labelledby="router-winbox-guide-title"
        className="mt-6 border-t border-border pt-5"
      >
        <h3 id="router-winbox-guide-title" className="text-base font-semibold text-ink-900">
          Step-by-step WinBox guide
        </h3>
        <p className="mt-1 mb-4 text-sm text-ink-600">
          Pick the setup that matches your router. Each guide lists the exact values to enter in Add
          router.
        </p>
        <DeploymentGuide />
      </section>
      <p className="mt-4 text-sm text-ink-600">
        {canManage ? (
          <Link
            to={`/routers/new${location.search}`}
            className="dashboard-data-link rounded-md font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Add router
          </Link>
        ) : (
          'Ask an owner or router manager to add the router.'
        )}{' '}
        · Staging and production each need their own router record and install command.
      </p>
    </section>
  );
}
