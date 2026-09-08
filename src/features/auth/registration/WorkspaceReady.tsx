import { useEffect, useRef } from 'react';
import { ArrowRight, BookOpen, CheckCircle2, MessageCircle } from 'lucide-react';
import { ButtonLink } from '@/components/ui';
import type { WorkspaceReady as ReadyData } from './api';

function externalLink(value: string | undefined) {
  try {
    const url = new URL(value ?? '');
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
export function WorkspaceReady({ result }: { result: ReadyData }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const whatsapp = externalLink(import.meta.env.VITE_WHATSAPP_COMMUNITY_URL);
  const guide = externalLink(import.meta.env.VITE_USER_GUIDE_URL) ?? '/guide';
  return (
    <section className="registration-ready" aria-labelledby="registration-title">
      <CheckCircle2 className="mx-auto size-14 text-brand-600" aria-hidden />
      <h1 id="registration-title" ref={heading} tabIndex={-1}>
        Workspace ready!
      </h1>
      <p>
        <strong>{result.workspace.name}</strong> has been created. Sign in to start setting up your
        hotspot business.
      </p>
      <dl className="registration-summary">
        <div>
          <dt>Workspace ID</dt>
          <dd>{result.workspace.slug}</dd>
        </div>
        <div>
          <dt>Sign-in username</dt>
          <dd>{result.username}</dd>
        </div>
      </dl>
      <ButtonLink to="/login" block size="lg">
        Access dashboard <ArrowRight className="size-4" aria-hidden />
      </ButtonLink>
      <div className="registration-connected">
        <h2>Stay connected</h2>
        {whatsapp ? (
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden />
            <span>
              <strong>Join WhatsApp</strong>
              <small>Updates and announcements</small>
            </span>
          </a>
        ) : (
          <div className="registration-link-unavailable">
            <MessageCircle aria-hidden />
            <span>
              <strong>WhatsApp community</strong>
              <small>Community link coming soon</small>
            </span>
          </div>
        )}
        <a
          href={guide}
          {...(guide.startsWith('https:') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          <BookOpen aria-hidden />
          <span>
            <strong>User guide</strong>
            <small>Get started with your workspace</small>
          </span>
        </a>
      </div>
    </section>
  );
}
