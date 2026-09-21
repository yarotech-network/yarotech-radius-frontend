export function ConnectNow({ url }: { url?: string | null | undefined }) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash)
      return null;
  } catch { return null; }
  return (
    <div className="mt-4 space-y-2">
      <a href={url} rel="noreferrer" referrerPolicy="no-referrer"
        className="inline-flex rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2">
        Connect now
      </a>
      <p className="text-sm text-ink-600">Join this business’s Wi-Fi first, then enter your access code on the login page.</p>
    </div>
  );
}
