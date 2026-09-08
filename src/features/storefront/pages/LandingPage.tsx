import { PlanLimits } from '@/features/settings/components/PlanLimits';
import { useEffect } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  CreditCard,
  Gauge,
  Radio,
  ShieldCheck,
  Ticket,
  Users,
  Wifi,
} from 'lucide-react';
import dashboardPreview from '@/assets/images/dashboard-preview.jpg';
import { env } from '@/app/config/env';
import { ButtonLink } from '@/components/ui';
import { EmptyState } from '@/components/feedback';
import { formatKobo } from '@/lib/formatting/money';
import { isApiError } from '@/services/api/errors';
import { PlanCard, PlanCardSkeleton } from '../components/PlanCard';
import { usePlatformPricing, usePublicPlans, usePublicTenant } from '../queries';

/**
 * `/` — public landing page (phase 12). Anonymous visitors see the marketing
 * page: hero, featured storefront plans for customers, subscription plans for
 * businesses, and the about section. Signed-in users never reach it — the
 * RootGate redirects them to their workspace.
 */
export default function LandingPage() {
  const featuredSlug = env.featuredStorefrontSlug;

  useEffect(() => {
    document.title = 'Yarotech RADIUS — Wi-Fi hotspot & voucher management';
  }, []);

  return (
    <div className="public-landing">
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
            <span>Sell access codes online.</span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-relaxed text-ink-600">
            Yarotech RADIUS gives hotspot operators one workspace for plans, vouchers, routers,
            agents and payments — and every business its own storefront where customers buy access
            codes with Paystack.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink to="/register" size="lg">
              Create your workspace
              <ArrowRight className="size-4" aria-hidden />
            </ButtonLink>
            <ButtonLink to="/pricing" size="lg" variant="secondary">
              See business pricing
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-ink-500">
            New workspaces start with an email verification code — no credit card required.
          </p>
        </div>
        <div className="public-preview">
          <div className="public-preview-frame">
            <div className="public-preview-bar">
              <span className="flex items-center gap-2">
                <Radio className="size-4" aria-hidden /> Your workspace
              </span>
              <span>Dashboard preview</span>
            </div>
            <img
              src={dashboardPreview}
              alt="The Yarotech RADIUS workspace dashboard"
              className="aspect-[16/10] w-full object-cover"
              fetchPriority="high"
              decoding="async"
            />
          </div>
        </div>
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
      <section className="public-process" aria-labelledby="getting-started">
        <SectionHeading
          id="getting-started"
          eyebrow="A clear path to launch"
          title="Your business. Connected."
          description="Bring your day-to-day hotspot operations together, from the first plan to the next customer."
        />
        <ol>
          {[
            ['Create your workspace', 'Register your business and verify your email address.'],
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
      {/* customers: featured storefront plans */}
      {featuredSlug && <FeaturedStorefront slug={featuredSlug} />}

      {/* businesses: subscription plans */}
      <BusinessPlans />

      <section className="public-cta">
        <div>
          <p className="public-eyebrow">Built around your business</p>
          <h2>Make the next connection simpler.</h2>
          <p>Manage your hotspot and give customers a straightforward way to buy access.</p>
        </div>
        <ButtonLink to="/register" size="lg">
          Start your workspace <ArrowRight className="size-4" aria-hidden />
        </ButtonLink>
      </section>
    </div>
  );
}

/* ---------- featured storefront (customer access codes) ---------- */

function FeaturedStorefront({ slug }: { slug: string }) {
  const tenant = usePublicTenant(slug);
  const tenantReady =
    tenant.data !== undefined || (!tenant.isPending && tenant.isError && !isApiError(tenant.error));

  const plans = usePublicPlans(tenant.data || tenantReady ? slug : null);

  if (tenant.isError && isApiError(tenant.error) && tenant.error.status === 404) {
    return null; // slug misconfigured — hide the section entirely
  }

  return (
    <section aria-labelledby="customer-plans">
      <SectionHeading
        id="customer-plans"
        eyebrow="For customers"
        title="Buy a Wi-Fi access code"
        description={
          tenant.data
            ? `Plans from ${tenant.data.name}. Pay with Paystack and your access code is emailed instantly.`
            : 'Pay with Paystack and your access code is emailed instantly.'
        }
      />
      {plans.isPending ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy>
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <PlanCardSkeleton />
            </li>
          ))}
        </ul>
      ) : plans.isError ? (
        <EmptyState
          icon={<Wifi className="size-6" aria-hidden />}
          title="Plans are unavailable right now"
          description="Please check back shortly."
        />
      ) : plans.data && plans.data.results.length > 0 ? (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.data.results.slice(0, 6).map((plan) => (
              <li key={plan.id}>
                <PlanCard
                  plan={plan}
                  action={
                    <ButtonLink to={`/s/${slug}/checkout/${plan.id}`} block>
                      Buy access code
                    </ButtonLink>
                  }
                />
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-ink-500">
            <Link to={`/s/${slug}`} className="font-medium text-brand-600 hover:underline">
              All plans and business details
              <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
            </Link>
          </p>
        </>
      ) : (
        <EmptyState
          icon={<Wifi className="size-6" aria-hidden />}
          title="No plans published yet"
          description="Check back soon — new plans are on the way."
        />
      )}
    </section>
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
        description="Everything you need to run vouchers, routers, agents and payments — choose a subscription duration and pay with Paystack."
      />
      {pricing.isPending ? (
        <ul className="grid gap-4 sm:grid-cols-2" aria-busy>
          {[0, 1].map((i) => (
            <li
              key={i}
              className="h-52 animate-pulse rounded-card border border-border bg-surface"
            />
          ))}
        </ul>
      ) : pricing.isError ? (
        <EmptyState
          icon={<Building2 className="size-6" aria-hidden />}
          title="Could not load business plans"
          description="Please try again shortly."
        />
      ) : pricing.data.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-6" aria-hidden />}
          title="Business plans coming soon"
          description="Register now and start on a free trial while we publish pricing."
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {pricing.data.slice(0, 4).map((plan) => (
            <li key={plan.id} className="public-plan">
              <h3 className="text-lg font-semibold text-brand-950">{plan.name}</h3>
              <p className="mt-1 text-3xl font-semibold text-ink-900 tabular-nums">
                {formatKobo(plan.price)}{' '}
                <span className="text-sm font-normal text-ink-500">
                  / {plan.duration_days} days
                </span>
              </p>
              <PlanLimits plan={plan} />
              {plan.features.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm text-ink-700">
                  {plan.features.slice(0, 5).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden />
                      <span>{typeof feature === 'string' ? feature : JSON.stringify(feature)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <ButtonLink to="/register" className="mt-6" block>
                Get started
              </ButtonLink>
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
    description: 'Live sessions, revenue and usage analytics the moment a customer connects.',
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
          <span className="font-semibold text-ink-900">Verified accounts only.</span> Every new
          workspace confirms its email with a one-time code — customers and operators always know
          who they are dealing with.
        </p>
      </div>
    </section>
  );
}

/* ---------- shared bits ---------- */

function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="public-section-heading">
      <p className="text-xs font-semibold tracking-wider text-brand-600 uppercase">{eyebrow}</p>
      <h2 id={id} className="public-section-title">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{description}</p>
    </header>
  );
}
