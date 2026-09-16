import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import networkSmall from '@/assets/images/isp-network-640.webp';
import networkLarge from '@/assets/images/isp-network-1280.webp';
import infrastructureSmall from '@/assets/images/isp-infrastructure-640.webp';
import infrastructureLarge from '@/assets/images/isp-infrastructure-1280.webp';

export function PublicImage({
  scene = 'network',
  priority = false,
  className,
}: {
  scene?: 'network' | 'infrastructure';
  priority?: boolean;
  className?: string;
}) {
  const infrastructure = scene === 'infrastructure';
  return (
    <img
      src={infrastructure ? infrastructureLarge : networkLarge}
      srcSet={`${infrastructure ? infrastructureSmall : networkSmall} 640w, ${infrastructure ? infrastructureLarge : networkLarge} 1280w`}
      sizes="(min-width: 1024px) 50vw, 100vw"
      width={1280}
      height={infrastructure ? 1920 : 853}
      alt={
        infrastructure
          ? 'ISP network rack with Ethernet switches and organised fibre connections'
          : 'Routers, network switches and fibre equipment for internet services'
      }
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      className={className}
    />
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <header className="public-section-heading">
      <p className="public-eyebrow">{eyebrow}</p>
      <h2 id={id} className="public-section-title">
        {title}
      </h2>
      <p className="text-ink-600">{description}</p>
    </header>
  );
}

export function WorkspaceCTA() {
  return (
    <section className="public-cta" aria-label="Create your workspace">
      <div>
        <p className="public-eyebrow">Your next connection starts here</p>
        <h2>Build a more connected business.</h2>
        <p>
          Bring your hotspot operations together and give customers a simpler way to buy access.
        </p>
      </div>
      <ButtonLink to="/register" size="lg">
        Create workspace <ArrowRight className="size-4" aria-hidden />
      </ButtonLink>
    </section>
  );
}

export function PublicFAQ() {
  return (
    <section className="public-faq" aria-labelledby="questions">
      <SectionHeading
        id="questions"
        eyebrow="A little clarity"
        title="Before you get started"
        description="A few helpful answers for your next step."
      />
      <div>
        {[
          [
            'Who is Yarotech for?',
            'Hotspot operators, cafés, hotels, estates and internet service businesses that need to manage routers, sell access and organise their team.',
          ],
          [
            'Does a business subscription include internet access?',
            'No. A business subscription gives you access to the management platform. You supply your internet connection and compatible MikroTik equipment.',
          ],
          [
            'How do my customers buy Wi-Fi?',
            'Customers visit your business storefront, choose an internet plan and continue to Paystack. Payment confirmation and access delivery are shown separately so customers know what happens next.',
          ],
          [
            'What do I need to set up?',
            'Start with an email address and your business details. Before selling access, prepare your router, internet plans and payment settings, then test your customer journey.',
          ],
        ].map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
