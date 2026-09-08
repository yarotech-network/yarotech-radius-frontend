import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowRight, BookOpen, MessageCircle, X } from 'lucide-react';

function communityUrl() {
  try {
    const url = new URL(import.meta.env.VITE_WHATSAPP_COMMUNITY_URL ?? '');
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function OverviewIntro() {
  const [dismissed, setDismissed] = useState(false);
  const whatsapp = communityUrl();
  if (dismissed) return null;
  return (
    <div className="overview-intro">
      <span className="overview-intro-icon">
        <BookOpen className="size-4" aria-hidden />
      </span>
      <p>
        <strong>Your workspace, ready for business.</strong>{' '}
        <span>Find setup instructions and practical tips in the user guide.</span>
      </p>
      <div className="overview-intro-actions">
        {whatsapp && (
          <a
            href={whatsapp}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join the WhatsApp community"
          >
            <MessageCircle className="size-4" aria-hidden />
          </a>
        )}
        <Link to="/guide">
          User guide <ArrowRight className="size-3.5" aria-hidden />
        </Link>
        <button
          type="button"
          aria-label="Dismiss getting started message"
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
