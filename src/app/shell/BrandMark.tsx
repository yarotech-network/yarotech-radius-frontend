import { env } from '@/app/config/env';
import { cn } from '@/lib/utilities/cn';
import logoUrl from '@/assets/brand/yarotech-logo-small.webp';

export function BrandMark({
  size = 'md',
  inverse = false,
  hideText = false,
  className,
}: {
  size?: 'sm' | 'md' | 'lg';
  inverse?: boolean;
  hideText?: boolean;
  className?: string;
}) {
  const box =
    size === 'lg'
      ? 'size-14 rounded-xl'
      : size === 'sm'
        ? 'size-8 rounded-lg'
        : 'size-9 rounded-lg';
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center overflow-hidden bg-white p-0.5 ring-1',
          box,
          inverse ? 'ring-white/20' : 'ring-border',
        )}
        aria-hidden
      >
        <img src={logoUrl} alt="" width={1270} height={1239} className="size-full object-contain" />
      </span>
      {!hideText && (
        <span
          className={cn(
            'font-semibold tracking-tight',
            size === 'lg' ? 'text-xl' : 'text-[15px]',
            inverse ? 'text-white' : 'text-brand-950',
          )}
        >
          {env.appName}
        </span>
      )}
    </span>
  );
}
