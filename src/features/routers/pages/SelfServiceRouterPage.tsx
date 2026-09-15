import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '@/components/layout';
import { Button, Card, Input } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { http } from '@/services/api/http';
import { errorMessage, isApiError } from '@/services/api/errors';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import type { NasDevice } from '@/types/api';
import { routerKeys } from '../queries';

export default function SelfServiceRouterPage() {
  const navigate = useNavigate();
  const queries = useQueryClient();
  const request = useRef({ payload: '', key: '' });
  const submitting = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [automatic, setAutomatic] = useState(true);
  const [customRange, setCustomRange] = useState(false);
  const [mode, setMode] = useState('create');
  const [nat, setNat] = useState('existing');

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    const payload: Record<string, string | boolean> = Object.fromEntries(
      [...form.entries()].filter(
        (entry): entry is [string, string] => typeof entry[1] === 'string',
      ),
    );
    payload.complete_hotspot_setup = automatic;
    payload.network_reviewed = form.has('network_reviewed');
    payload.dhcp_range_mode = customRange ? 'custom' : 'automatic';
    const serialized = JSON.stringify(payload);
    if (request.current.payload !== serialized)
      request.current = { payload: serialized, key: newIdempotencyKey('router') };
    submitting.current = true;
    setBusy(true);
    setError('');
    try {
      const router = await http.post<NasDevice>('/routers/register/', payload, {
        idempotencyKey: request.current.key,
      });
      await queries.invalidateQueries({ queryKey: routerKeys.all });
      queries.setQueryData(routerKeys.detail(router.id), router);
      navigate(`/routers/${router.id}?tab=setup`);
    } catch (failure) {
      const fields = isApiError(failure) ? Object.values(failure.fields).flat().join(' ') : '';
      setError(fields || errorMessage(failure));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  function field(label: string, name: string, required = false, value = '', hint = '') {
    return (
      <label className="grid gap-1 text-sm" key={name}>
        <span>
          {label}
          {required ? ' *' : ''}
        </span>
        <Input name={name} required={required} defaultValue={value} disabled={busy} />
        {hint && <span className="text-xs text-ink-500">{hint}</span>}
      </label>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add New Router"
        backTo="/routers"
        description="Enter your router and network details. Its tunnel address, keys and RADIUS secret are generated automatically."
      />
      <form onSubmit={(event) => void submit(event)}>
        <Card className="space-y-6">
          {error && (
            <Alert tone="danger" title="Router could not be prepared">
              {error}
            </Alert>
          )}
          <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
            <legend className="mb-4 font-semibold">Router details</legend>
            {field('Router name', 'name', true)}
            {field(
              'NAS identifier',
              'nas_identifier',
              false,
              '',
              'Generated automatically when blank.',
            )}
            {field(
              'HotSpot LAN interface',
              'hotspot_interface',
              true,
              '',
              'Exact existing customer-facing bridge, Ethernet or VLAN name; never the WAN.',
            )}
            {field(
              'HotSpot profile',
              'hotspot_profile',
              !automatic,
              '',
              automatic
                ? 'Generated automatically when blank.'
                : 'Enter the existing profile name.',
            )}
            {field('Location', 'location')}
            {field('MikroTik model', 'model')}
            {field('RouterOS version', 'routeros_version')}
            {field('Notes', 'notes')}
          </fieldset>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={automatic}
              disabled={busy}
              onChange={(e) => setAutomatic(e.target.checked)}
            />
            Set up HotSpot automatically
          </label>
          {automatic && (
            <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-4 font-semibold">HotSpot network</legend>
              <p className="text-sm sm:col-span-2">
                Automatic setup requires RouterOS 7.17 or newer stable 7.x. The script checks the
                existing network before creating missing objects.
              </p>
              {field(
                'LAN gateway/subnet',
                'gateway_cidr',
                true,
                '',
                'Use the confirmed gateway with its prefix, for example 192.168.50.1/24.',
              )}
              <label className="grid gap-1 text-sm">
                DHCP setup
                <select
                  name="network_mode"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="rounded border p-2"
                >
                  <option value="create">Create missing compatible objects</option>
                  <option value="reuse">Reuse existing DHCP by exact name</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={customRange}
                  onChange={(e) => setCustomRange(e.target.checked)}
                />
                Use custom DHCP range
              </label>
              {customRange &&
                field(
                  'DHCP address range',
                  'dhcp_range',
                  true,
                  '',
                  'First IP-last IP inside the subnet, excluding the gateway.',
                )}
              {field('DNS servers', 'dns_servers', true, '1.1.1.1,8.8.8.8')}
              {field('HotSpot DNS name', 'hotspot_dns_name', true, 'login.hotspot.lan')}
              {mode === 'reuse' && (
                <>
                  {field('Existing DHCP pool', 'reuse_pool', true)}
                  {field('Existing DHCP server', 'reuse_dhcp', true)}
                </>
              )}
              {field(
                'Existing HotSpot server',
                'reuse_hotspot',
                false,
                '',
                'Leave blank to create a dedicated server.',
              )}
              <label className="grid gap-1 text-sm">
                NAT configuration
                <select
                  name="nat_mode"
                  value={nat}
                  onChange={(e) => setNat(e.target.value)}
                  className="rounded border p-2"
                >
                  <option value="existing">Keep existing NAT unchanged</option>
                  <option value="interface">Add NAT through a WAN interface</option>
                  <option value="interface-list">Add NAT through a WAN interface-list</option>
                </select>
              </label>
              {nat !== 'existing' &&
                field('WAN interface or interface-list', 'wan_interface', true)}
            </fieldset>
          )}
          <label className="flex items-start gap-2">
            <input name="network_reviewed" type="checkbox" required disabled={busy} />I confirm this
            router’s LAN interface and network settings are correct.
          </label>
          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => navigate('/routers')}
            >
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Create Router
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
