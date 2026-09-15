export const voucherCodeFormatOptions = [
  { value: 'legacy', label: 'Readable mixed (existing)' },
  { value: 'numeric', label: 'Numbers only' },
  { value: 'alphabetic', label: 'Letters only' },
  { value: 'alphanumeric', label: 'Letters and numbers' },
];
export const planCodeFormatOptions = [
  { value: 'tenant_default', label: 'Business default' },
  ...voucherCodeFormatOptions,
];
