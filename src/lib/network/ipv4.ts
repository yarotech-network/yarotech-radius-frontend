/** Small IPv4 helpers for network forms. Addresses are handled as unsigned 32-bit numbers. */

const OCTET = '(25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)';
const IPV4 = new RegExp(`^${OCTET}(\\.${OCTET}){3}$`);

export function isIpv4(value: string): boolean {
  return IPV4.test(value.trim());
}

export function ipToNumber(ip: string): number {
  return ip.split('.').reduce((acc, octet) => acc * 256 + Number(octet), 0) >>> 0;
}

export function numberToIp(value: number): string {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join('.');
}

function maskFor(prefix: number): number {
  return prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
}

export interface Cidr {
  ip: string;
  prefix: number;
  address: number;
  network: number;
  broadcast: number;
}

/** Parse "192.168.50.1/24"; null when malformed. */
export function parseCidr(value: string): Cidr | null {
  const match = /^([0-9.]+)\/([0-9]{1,2})$/.exec(value.trim());
  if (!match || !isIpv4(match[1]!)) return null;
  const prefix = Number(match[2]);
  if (prefix > 32) return null;
  const address = ipToNumber(match[1]!);
  const network = (address & maskFor(prefix)) >>> 0;
  const broadcast = (network | (~maskFor(prefix) >>> 0)) >>> 0;
  return { ip: match[1]!, prefix, address, network, broadcast };
}

const PRIVATE_BLOCKS = [
  ['10.0.0.0', 8],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const;

/** True when the whole network sits inside an RFC 1918 private block. */
export function isPrivateNetwork({ network, prefix }: Pick<Cidr, 'network' | 'prefix'>): boolean {
  return PRIVATE_BLOCKS.some(
    ([base, size]) => prefix >= size && (network & maskFor(size)) >>> 0 === ipToNumber(base),
  );
}

/** Why a gateway/prefix cannot be a customer LAN, or null when it can. */
export function lanGatewayProblem(value: string): string | null {
  const cidr = parseCidr(value);
  if (!cidr) return 'Enter the gateway with its prefix, for example 10.20.0.1/24.';
  if (cidr.prefix >= 31) return '/31 and /32 leave no addresses for customers. Use /24 or similar.';
  if (cidr.address === cidr.network || cidr.address === cidr.broadcast)
    return 'The gateway cannot be the first or last address of the network.';
  if (!isPrivateNetwork(cidr)) return 'Use a private network (10.x, 172.16–31.x or 192.168.x).';
  return null;
}

/**
 * The DHCP range the server picks automatically: the larger side of the subnet around the
 * gateway (the lower side on a tie), matching the backend's automatic_dhcp_range.
 */
export function automaticDhcpRange(
  value: string,
): { first: string; last: string; size: number } | null {
  const cidr = parseCidr(value);
  if (!cidr || lanGatewayProblem(value)) return null;
  const sides = [
    [cidr.network + 1, cidr.address - 1],
    [cidr.address + 1, cidr.broadcast - 1],
  ].filter(([start, end]) => start! <= end!) as [number, number][];
  const [start, end] = sides.reduce((best, side) =>
    side[1] - side[0] > best[1] - best[0] ? side : best,
  );
  return { first: numberToIp(start), last: numberToIp(end), size: end - start + 1 };
}

/** Parse "first-last" inside the gateway's subnet, excluding the gateway; null when invalid. */
export function dhcpRangeProblem(range: string, gateway: string): string | null {
  const parts = range.split('-').map((part) => part.trim());
  const cidr = parseCidr(gateway);
  if (parts.length !== 2 || !isIpv4(parts[0]!) || !isIpv4(parts[1]!))
    return 'Enter the range as first-last, for example 10.20.0.10-10.20.0.200.';
  const start = ipToNumber(parts[0]!);
  const end = ipToNumber(parts[1]!);
  if (start > end) return 'The first address must come before the last.';
  if (cidr && (start <= cidr.network || end >= cidr.broadcast))
    return 'Keep the range inside the customer network.';
  if (cidr && start <= cidr.address && cidr.address <= end)
    return 'The range must not include the gateway address.';
  return null;
}
