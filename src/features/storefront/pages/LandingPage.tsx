import { BusinessPlanCard } from '../components/BusinessPlanCard';
import { PublicImage, PublicFAQ, SectionHeading, WorkspaceCTA } from '../components/PublicContent';
import { Link } from 'react-router';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CreditCard,
  Gauge,
  Radio,
  ShieldCheck,
  Ticket,
  Users,
  Wifi,
} from 'lucide-react';
import dashboardPreview from '@/assets/images/workspace-preview.webp';
import { ButtonLink } from '@/components/ui';
import { EmptyState, ErrorState } from '@/components/feedback';
import { usePlatformPricing } from '../queries';

/**
 * `/` — public landing page (phase 12). Anonymous visitors see the marketing
 * page: hero, product overview, subscription plans for
 * businesses, and the about section. Signed-in users never reach it — the
 * RootGate redirects them to their workspace.
 */
export default function LandingPage() {
  return (
    <div className="public-landing">
      <title>Yarotech RADIUS - Wi-Fi hotspot &amp; voucher management</title>
      {/* hero */}
      <section className="public-hero">
        <div>
          <p className="public-eyebrow">
            <Wifi className="size-3.5 text-brand-600" aria-hidden />
            Hotspot &amp; voucher management platform
          </p>
          <h1 className="public-hero-title">
            Run your <span className="whitespace-nowrap">Wi-Fi</span> business.
            <br />
            <span>Make every connection count.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-600">
            Yarotech RADIUS gives hotspot operators one workspace for plans, vouchers, routers,
            agents and payments — and every business its own storefront where customers buy access
            codes with Paystack.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink to="/register" size="lg">
              Create workspace
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink to="/pricing" size="lg" variant="secondary">
              View business plans
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-ink-500">
            New workspaces start with an email verification code — no credit card required.
          </p>
        </div>
        <figure className="public-hero-visual">
          <PublicImage className="public-scene" priority />
          <figcaption>
            <Wifi className="size-5" aria-hidden />
            <div>
              <strong>Your business. Better connected.</strong>
              <span>From the first plan to the next customer.</span>
            </div>
          </figcaption>
        </figure>
      </section>

      <div className="public-capabilities" aria-label="Platform capabilities">
        {[
          [Ticket, 'Voucher management'],
          [Radio, 'MikroTik routers'],
          [CreditCard, 'Paystack payments'],
          [Users, 'Agent sales'],
        ].map(([Icon, label]) => {
          const CapabilityIcon = Icon as typeof Ticket;
          return (
            <span key={String(label)}>
              <CapabilityIcon className="size-5" aria-hidden />
              {String(label)}
            </span>
          );
        })}
      </div>
      <About />
      <section className="public-product" aria-labelledby="workspace-preview">
        <SectionHeading
          id="workspace-preview"
          eyebrow="A clearer view of your business"
          title="One workspace. The everyday essentials."
          description="Keep your routers, vouchers, customer activity and business figures within reach."
        />
        <figure className="public-preview">
          <div className="public-preview-frame">
            <div className="public-preview-bar">
              <span>Yarotech workspace</span>
              <span>Preview with sample data</span>
            </div>
            <img
              src={dashboardPreview}
              alt="Yarotech workspace overview with sample business data"
              width={1440}
              height={1000}
              loading="lazy"
              decoding="async"
            />
          </div>
          <figcaption className="mt-3 text-center text-xs text-ink-600">
            Actual product interface. Illustrative sample data.
          </figcaption>
        </figure>
      </section>
      <section className="public-process" aria-labelledby="getting-started">
        <SectionHeading
          id="getting-started"
          eyebrow="A clear path to launch"
          title="Your business. Connected."
          description="Bring your day-to-day hotspot operations together, from the first plan to the next customer."
        />
        <ol>
          {[
            ['Create workspace', 'Register your business and verify your email address.'],
            [
              'Set up your service',
              'Connect your routers, configure plans and prepare your storefront.',
            ],
            ['Start selling access', 'Share your storefront or let your agents sell vouchers.'],
          ].map(([title, copy], index) => (
            <li key={title}>
              <span>0{index + 1}</span>
              <h3>{title}</h3>
              <p>{copy}</p>
            </li>
          ))}
        </ol>
      </section>
      {/* businesses: subscription plans */}
      <BusinessPlans />

      <PublicFAQ />
      <WorkspaceCTA />
    </div>
  );
}

/* ---------- businesses: subscription plans ---------- */

function BusinessPlans() {
  const pricing = usePlatformPricing();

  return (
    <section aria-labelledby="business-plans">
      <SectionHeading
        id="business-plans"
        eyebrow="For businesses"
        title="Plans for hotspot operators"
        description="Compare business subscriptions, then choose your plan in workspace Settings. Your customer Wi-Fi plans are managed separately."
      />
      {pricing.isPending ? (
        <ul className="public-business-grid" aria-busy>
          {[0, 1].map((i) => (
            <li
              key={i}
              className="h-52 animate-pulse rounded-card border border-border bg-surface"
            />
          ))}
        </ul>
      ) : pricing.isError ? (
        <ErrorState
          error={pricing.error}
          onRetry={() => void pricing.refetch()}
          title="Could not load business plans"
        />
      ) : pricing.data.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-6" aria-hidden />}
          title="Business plans coming soon"
          description="Business subscriptions will appear here when published."
        />
      ) : (
        <ul className="public-business-grid">
          {pricing.data.slice(0, 4).map((plan) => (
            <li key={plan.id}>
              <BusinessPlanCard plan={plan} />
            </li>
          ))}
        </ul>
      )}
      <p className="mt-5 text-sm text-ink-500">
        <Link to="/pricing" className="font-medium text-brand-600 hover:underline">
          Compare all business plans
          <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
        </Link>
      </p>
    </section>
  );
}

/* ---------- about ---------- */

const ABOUT_FEATURES = [
  {
    icon: Ticket,
    title: 'Vouchers & access codes',
    description:
      'Generate single or bulk codes with duration, data and speed limits — delivered to customers by email.',
  },
  {
    icon: Radio,
    title: 'Router fleet',
    description:
      'Onboard MikroTik routers, run RADIUS tests and monitor provisioning from one console.',
  },
  {
    icon: Users,
    title: 'Agents & commissions',
    description:
      'Let agents sell vouchers on your behalf with wallets, funding and automatic commission tracking.',
  },
  {
    icon: CreditCard,
    title: 'Payments built in',
    description: 'Paystack checkout on every storefront, with reconciliation and recovery tooling.',
  },
  {
    icon: Gauge,
    title: 'Live insight',
    description: 'Review session activity, revenue and usage reported to your workspace.',
  },
  {
    icon: ShieldCheck,
    title: 'Multi-tenant by design',
    description:
      'Every business gets an isolated workspace, its own storefront and its own settings.',
  },
] as const;

function About() {
  return (
    <section id="features" className="public-features" aria-labelledby="about">
      <SectionHeading
        id="about"
        eyebrow="About"
        title="Built for West African hotspot businesses"
        description="Yarotech RADIUS is a product of Yarotech Network — built with the workflows of cyber cafés, hotels, estates and ISPs in mind."
      />
      <div className="public-feature-grid">
        {ABOUT_FEATURES.map((feature) => (
          <article key={feature.title} className="public-feature">
            <feature.icon className="size-5 text-brand-600" aria-hidden />
            <h3 className="mt-3 font-semibold text-brand-950">{feature.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{feature.description}</p>
          </article>
        ))}
      </div>
      <div className="mt-8 flex items-center gap-3 rounded-card border border-border bg-surface-muted p-5">
        <BadgeCheck className="size-5 shrink-0 text-brand-600" aria-hidden />
        <p className="text-sm text-ink-700">
          <span className="font-semibold text-ink-900">An email-verified start.</span> Every new
          workspace confirms its email with a one-time code before creating a business account.
        </p>
      </div>
    </section>
  );
}
