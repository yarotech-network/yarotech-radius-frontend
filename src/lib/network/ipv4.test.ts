import { describe, expect, it } from 'vitest';
import {
  automaticDhcpRange,
  dhcpRangeProblem,
  isIpv4,
  isPrivateNetwork,
  lanGatewayProblem,
  numberToIp,
  ipToNumber,
  parseCidr,
} from './ipv4';

describe('ipv4 helpers', () => {
  it('parses addresses and CIDRs', () => {
    expect(isIpv4('192.168.1.1')).toBe(true);
    expect(isIpv4('256.1.1.1')).toBe(false);
    expect(numberToIp(ipToNumber('10.20.0.1'))).toBe('10.20.0.1');
    expect(parseCidr('10.20.0.1/24')).toMatchObject({
      prefix: 24,
      network: ipToNumber('10.20.0.0'),
      broadcast: ipToNumber('10.20.0.255'),
    });
    expect(parseCidr('10.20.0.1')).toBeNull();
    expect(parseCidr('10.20.0.1/33')).toBeNull();
  });

  it('accepts only usable private gateways', () => {
    expect(lanGatewayProblem('10.20.0.1/24')).toBeNull();
    expect(lanGatewayProblem('172.20.5.1/16')).toBeNull();
    expect(lanGatewayProblem('8.8.8.1/24')).toMatch(/private network/);
    expect(lanGatewayProblem('10.20.0.0/24')).toMatch(/first or last/);
    expect(lanGatewayProblem('10.20.0.1/31')).toMatch(/no addresses/);
    expect(lanGatewayProblem('nonsense')).toMatch(/prefix/);
    expect(isPrivateNetwork({ network: ipToNumber('172.32.0.0'), prefix: 16 })).toBe(false);
  });

  it('matches the backend automatic DHCP range', () => {
    expect(automaticDhcpRange('192.168.50.1/24')).toEqual({
      first: '192.168.50.2',
      last: '192.168.50.254',
      size: 253,
    });
    // Gateway in the middle: the larger upper side wins.
    expect(automaticDhcpRange('10.0.0.100/24')).toMatchObject({
      first: '10.0.0.101',
      last: '10.0.0.254',
    });
    // Gateway at the top: the lower side.
    expect(automaticDhcpRange('10.0.0.254/24')).toMatchObject({
      first: '10.0.0.1',
      last: '10.0.0.253',
    });
    expect(automaticDhcpRange('8.8.8.1/24')).toBeNull();
  });

  it('validates a custom DHCP range against the gateway', () => {
    expect(dhcpRangeProblem('10.20.0.10-10.20.0.200', '10.20.0.1/24')).toBeNull();
    expect(dhcpRangeProblem('10.20.0.200-10.20.0.10', '10.20.0.1/24')).toMatch(/before/);
    expect(dhcpRangeProblem('10.20.0.0-10.20.0.20', '10.20.0.1/24')).toMatch(/inside/);
    expect(dhcpRangeProblem('10.20.0.1-10.20.0.20', '10.20.0.1/24')).toMatch(/gateway/);
    expect(dhcpRangeProblem('10.20.0.10', '10.20.0.1/24')).toMatch(/first-last/);
  });
});
