import { env } from '@/app/config/env';
import { cn } from '@/lib/utilities/cn';
import logoUrl from '@/assets/brand/yarotech-logo-small.webp';

export function BrandMark({
  size = 'md',
  inverse = false,
  hideText = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  inverse?: boolean;
  hideText?: boolean;
  className?: string;
}) {
  const box =
    size === 'xl'
      ? 'size-10 rounded-xl'
      : size === 'lg'
        ? 'size-11 rounded-xl'
        : size === 'sm'
          ? 'size-7 rounded-lg'
          : 'size-9 rounded-lg';

  const ringStyle = inverse
    ? 'ring-2 ring-white/15 shadow-lg shadow-black/30'
    : 'ring-1 ring-border shadow-sm';

  return (
    <span className={cn('inline-flex items-center gap-3', className)}>
      {/* Logo icon */}
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden bg-white p-0.5',
          box,
          ringStyle,
        )}
        aria-hidden
      >
        <img src={logoUrl} alt="" width={1270} height={1239} className="size-full object-contain" />
      </span>

      {/* Wordmark */}
      {!hideText && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              'font-bold tracking-tight',
              size === 'xl' || size === 'lg' ? 'text-[16px]' : 'text-[14px]',
              inverse ? 'text-white' : 'text-brand-950',
            )}
          >
            {env.appName}
          </span>
          <span
            className={cn(
              'mt-0.5 font-medium tracking-wide',
              size === 'xl' || size === 'lg' ? 'text-[10px]' : 'text-[9px]',
              inverse ? 'text-white/45' : 'text-ink-400',
            )}
            style={{ letterSpacing: '0.1em', textTransform: 'uppercase' }}
          >
            Network Console
          </span>
        </span>
      )}
    </span>
  );
}
