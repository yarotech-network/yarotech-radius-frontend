import { Link } from 'react-router';
import { Mail, MapPin, Phone, ArrowUpRight } from 'lucide-react';
import { publicContact } from '../publicContact';
import { WorkspaceCTA } from '../components/PublicContent';

export default function ContactPage() {
  return (
    <div className="public-editorial">
      <title>Contact · Yarotech RADIUS</title>
      <header className="public-page-heading">
        <p className="public-eyebrow">Let's connect</p>
        <h1 className="public-section-title">A conversation is a good start.</h1>
        <p className="text-ink-600">
          Have a question about Yarotech or setting up your hotspot business? Reach our team
          directly.
        </p>
      </header>
      <div className="public-contact-grid">
        <a href={`mailto:${publicContact.email}`} className="public-contact-card">
          <Mail aria-hidden />
          <h2>Email us</h2>
          <p>{publicContact.email}</p>
          <span>
            Open your email app <ArrowUpRight aria-hidden />
          </span>
        </a>
        <a href={`tel:${publicContact.phone}`} className="public-contact-card">
          <Phone aria-hidden />
          <h2>Give us a call</h2>
          <p>{publicContact.phoneDisplay}</p>
          <span>
            Call Yarotech <ArrowUpRight aria-hidden />
          </span>
        </a>
        <div className="public-contact-card">
          <MapPin aria-hidden />
          <h2>Find us in Kano</h2>
          <address>{publicContact.address}</address>
          <p className="text-sm">Contact us before visiting.</p>
        </div>
      </div>
      <section className="public-help-strip">
        <div>
          <h2>Looking for help with a Wi-Fi purchase?</h2>
          <p>
            Contact the business you bought from with your payment reference. Never share passwords,
            access codes or renewal tokens.
          </p>
        </div>
        <Link to="/guide" className="font-semibold text-brand-700 underline underline-offset-4">
          Read the setup guide
        </Link>
      </section>
      <WorkspaceCTA />
    </div>
  );
}
