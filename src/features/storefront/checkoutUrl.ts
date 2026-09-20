/** Server chooses the tenant's gateway; only hosted payment destinations are allowed. */
export function checkoutUrl(value: string) {
  const url = new URL(value);
  const hosts = [
    'checkout.paystack.com',
    'sandboxcashier.opaycheckout.com',
    'cashier.opaycheckout.com',
  ];
  if (
    url.protocol !== 'https:' ||
    !hosts.includes(url.hostname) ||
    url.username ||
    url.password ||
    (url.port && url.port !== '443') ||
    /[\\\s]/.test(value)
  ) {
    throw new Error('The payment link could not be verified.');
  }
  return url.href;
}
