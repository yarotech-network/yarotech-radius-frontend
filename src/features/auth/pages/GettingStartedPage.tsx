import { ButtonLink } from '@/components/ui';
export default function GettingStartedPage() {
  return (
    <article className="mx-auto max-w-3xl py-8">
      <header className="public-page-heading">
        <p className="public-eyebrow">User guide</p>
        <h1 className="public-section-title">Get your workspace ready</h1>
        <p>A quick guide for new hotspot operators.</p>
      </header>
      <ol className="space-y-8">
        {[
          [
            'Sign in to your workspace',
            'Use the username and password you chose during registration. Your email has already been verified.',
          ],
          [
            'Review your business settings',
            'Open Settings to review your business details and subscription. Choose a business plan that fits your router and voucher needs.',
          ],
          [
            'Connect your routers',
            'Open Routers, register your MikroTik router and follow the setup instructions. Check connectivity before offering internet access.',
          ],
          [
            'Create your internet plans',
            'Open Plans to configure prices, duration, data and speed limits for your customers.',
          ],
          [
            'Prepare your storefront',
            'Configure your payment settings, review your published plans, then share your storefront link with customers. Test your setup before launching.',
          ],
        ].map(([title, copy], index) => (
          <li key={title} className="border-t border-border pt-6">
            <h2 className="text-lg font-semibold text-brand-950">
              {index + 1}. {title}
            </h2>
            <p className="mt-2 leading-relaxed text-ink-600">{copy}</p>
          </li>
        ))}
      </ol>
      <ButtonLink className="mt-8" to="/login">
        Sign in to get started
      </ButtonLink>
    </article>
  );
}
