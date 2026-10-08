import { describe, expect, it } from 'vitest';
import type { MacDevice } from '@/types/api';
import { accessText, effectiveStatus, sessionText } from './deviceStatus';

const NOW = new Date('2026-10-08T12:00:00Z').getTime();
const device = (extra: Partial<MacDevice> = {}): MacDevice => ({
  id: 1,
  mac_address: 'AA:BB:CC:DD:EE:FF',
  device_name: 'TV',
  plan: 1,
  plan_name: 'Daily',
  tenant: 1,
  is_active: true,
  expires_at: '2026-10-10T12:00:00Z',
  created_at: '2026-10-01T12:00:00Z',
  ...extra,
});

describe('device status', () => {
  it('matches the backend effective status rules', () => {
    expect(effectiveStatus(device({ access_type: 'timed' }), NOW)).toBe('active');
    expect(
      effectiveStatus(device({ access_type: 'timed', expires_at: '2026-10-01T00:00:00Z' }), NOW),
    ).toBe('expired');
    expect(effectiveStatus(device({ access_type: 'timed', expires_at: null }), NOW)).toBe(
      'expired',
    );
    expect(effectiveStatus(device({ access_type: 'permanent', expires_at: null }), NOW)).toBe(
      'active',
    );
    expect(effectiveStatus(device({ is_active: false }), NOW)).toBe('suspended');
    expect(effectiveStatus(device({ status: 'revoked' }), NOW)).toBe('revoked');
    expect(effectiveStatus(device({ status: 'deleted' }), NOW)).toBe('deleted');
  });

  it('describes access and recorded sessions in plain words', () => {
    expect(accessText(device({ access_type: 'permanent', expires_at: null }), NOW)).toBe(
      'Permanent access',
    );
    expect(accessText(device(), NOW)).toBe('Expires in 2 days');
    expect(accessText(device({ expires_at: '2026-10-06T12:00:00Z' }), NOW)).toBe(
      'Expired 2 days ago',
    );
    expect(sessionText(device({ accounting: null })).text).toBe('Usage unavailable');
    expect(
      sessionText(
        device({
          accounting: {
            available: true,
            session_count: 2,
            open_sessions: 1,
            bytes_total: 10,
            last_connected_at: null,
          },
        }),
      ),
    ).toEqual({ text: '1 open', open: true });
  });
});
