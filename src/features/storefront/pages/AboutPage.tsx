import { Radio, Ticket, Users } from 'lucide-react';
import { PublicImage, SectionHeading, WorkspaceCTA } from '../components/PublicContent';

export default function AboutPage() {
  return (
    <div className="public-editorial">
      <title>About Yarotech · Yarotech RADIUS</title>
      <section className="public-hero">
        <div>
          <p className="public-eyebrow">About Yarotech</p>
          <h1 className="public-hero-title">
            Local understanding.
            <br />
            <span>Connected ambition.</span>
          </h1>
          <p className="public-lead">
            Technology should make running your Wi-Fi business easier. We bring the everyday
            essentials into one workspace.
          </p>
          <p className="mt-5 text-ink-600">
            Yarotech RADIUS is a product of Yarotech Network, based in Kano, Nigeria. It is built
            around the needs of hotspot operators, cafés, hotels, estates and internet service
            businesses.
          </p>
        </div>
        <PublicImage className="public-scene" priority />
      </section>
      <section aria-labelledby="about-purpose">
        <SectionHeading
          id="about-purpose"
          eyebrow="Built around everyday work"
          title="Less switching. More clarity."
          description="Bring your network, customer access and team operations together."
        />
        <div className="public-feature-grid">
          {[
            {
              icon: Radio,
              title: 'Manage your network',
              copy: 'Organise MikroTik routers and follow their setup and connectivity checks from your workspace.',
            },
            {
              icon: Ticket,
              title: 'Make access easier to sell',
              copy: 'Create internet plans and vouchers, then give customers a storefront with Paystack checkout.',
            },
            {
              icon: Users,
              title: 'Keep your team together',
              copy: 'Manage agent sales and business settings with access appropriate to each role.',
            },
          ].map(({ icon: Icon, title, copy }) => (
            <article className="public-feature" key={title}>
              <Icon aria-hidden />
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </div>
      </section>
      <WorkspaceCTA />
    </div>
  );
}
