const COMPACT_NAIRA = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const COMPACT_NUMBER = new Intl.NumberFormat('en-NG', {
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function compactKobo(kobo: number) {
  return COMPACT_NAIRA.format(kobo / 100);
}

export function compactNumber(value: number) {
  return COMPACT_NUMBER.format(value);
}
