import { render, screen } from '@testing-library/react';
import { RouterConnectionBadge, RouterTelemetry } from './RouterTelemetry';
import type { RouterMonitoring } from '@/types/api/routers';
const sample = (extra: Partial<RouterMonitoring> = {}): RouterMonitoring => ({
  online: true,
  monitoring_fresh: true,
  monitor_checked_at: new Date().toISOString(),
  telemetry_available: false,
  ...extra,
});
it('shows online despite missing management metrics', () => {
  render(
    <>
      <RouterConnectionBadge health={sample()} />
      <RouterTelemetry health={sample({ telemetry_error: 'credentials_required' })} />
    </>,
  );
  expect(screen.getByText('Online')).toBeInTheDocument();
  expect(screen.getByText(/Configure RouterOS management credentials/)).toBeInTheDocument();
});
it('shows stale evidence as unknown and hides old metrics', () => {
  const health = sample({
    monitor_checked_at: '2000-01-01T00:00:00Z',
    telemetry_available: true,
    telemetry: {
      cpu_percent: 99,
      free_memory_bytes: 1,
      total_memory_bytes: 2,
      uptime: '1d',
      interfaces: [],
    },
  });
  render(
    <>
      <RouterConnectionBadge health={health} />
      <RouterTelemetry health={health} />
    </>,
  );
  expect(screen.getByText('Unknown')).toBeInTheDocument();
  expect(screen.queryByText('99%')).not.toBeInTheDocument();
});
it('shows confirmed offline', () => {
  render(<RouterConnectionBadge health={sample({ online: false })} />);
  expect(screen.getByText('Offline')).toBeInTheDocument();
});
it('renders CPU, memory, uptime and interface observations', () => {
  render(
    <RouterTelemetry
      health={sample({
        telemetry_available: true,
        telemetry: {
          cpu_percent: 20,
          free_memory_bytes: 1048576,
          total_memory_bytes: 2097152,
          uptime: '2d',
          interfaces: [
            {
              name: 'ether1',
              type: 'ether',
              running: true,
              disabled: false,
              rx_bytes: 1024,
              tx_bytes: 2048,
            },
          ],
        },
      })}
    />,
  );
  expect(screen.getByText('20%')).toBeInTheDocument();
  expect(screen.getByText('2d')).toBeInTheDocument();
  expect(screen.getByRole('table', { name: 'Router interfaces' })).toBeInTheDocument();
});
