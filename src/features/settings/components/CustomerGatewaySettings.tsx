import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrincipal } from '@/app/auth/useAuth';
import { http } from '@/services/api/http';
import { CreditCard } from 'lucide-react';
import { Badge, Button, FormField, Input, PasswordInput, Select } from '@/components/ui';
import { Alert, ErrorState } from '@/components/feedback';
import { SettingsCard } from './SettingsCard';

type Gateway = {
  provider: 'paystack' | 'opay';
  mode: 'test' | 'live' | null;
  configured: boolean;
  legacy: boolean;
  account_id: string | null;
};
type GatewayWrite = {
  provider: Gateway['provider'];
  mode: 'test' | 'live';
  secret_key: string;
  public_key?: string;
  merchant_id?: string;
};
const path = '/payments/customer-gateway/';

export function CustomerGatewaySettings() {
  const principal = usePrincipal();
  if (principal.kind !== 'member' || principal.role !== 'owner') return null;
  return <GatewayForm key={principal.tenantId} tenantId={principal.tenantId} />;
}

function GatewayForm({ tenantId }: { tenantId: number }) {
  const client = useQueryClient();
  const queryKey = ['settings', 'customer-gateway', tenantId];
  const query = useQuery({ queryKey, queryFn: () => http.get<Gateway>(path), retry: false });
  const [provider, setProvider] = useState<Gateway['provider']>('paystack');
  // Until the owner picks a mode, keep the active one so re-saving keys never flips live to test.
  const [modeChoice, setMode] = useState<'test' | 'live' | null>(null);
  const [secret, setSecret] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [merchant, setMerchant] = useState('');
  const mode = modeChoice ?? query.data?.mode ?? 'test';
  const submitting = useRef(false);
  const save = useMutation({
    mutationFn: (data: GatewayWrite) => http.put<Gateway>(path, data),
    onSuccess: (data) => {
      client.setQueryData(queryKey, data);
      setSecret('');
      setPublicKey('');
      setMerchant('');
    },
  });
  return (
    <SettingsCard
      id="customer-gateway"
      title="Customer payment gateway"
      icon={<CreditCard />}
      description="Where customers pay when they buy access codes on your storefront, WhatsApp or for devices. Only the workspace owner can change it."
    >
      {query.isPending ? (
        <p role="status">Loading payment settings…</p>
      ) : query.isError ? (
        <ErrorState
          error={query.error}
          onRetry={() => void query.refetch()}
          title="Gateway settings could not be loaded"
        />
      ) : (
        <form
          className="space-y-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (submitting.current) return;
            submitting.current = true;
            try {
              await save.mutateAsync({
                provider,
                mode,
                secret_key: secret,
                ...(provider === 'opay' ? { public_key: publicKey, merchant_id: merchant } : {}),
              });
            } catch {
              /* Display the mutation error without logging credentials. */
            } finally {
              submitting.current = false;
            }
          }}
        >
          <div className="flex flex-wrap items-center gap-2 rounded-control bg-surface-muted px-3 py-2.5 text-sm">
            <span className="text-ink-600">Active now:</span>
            <strong className="text-ink-900">
              {query.data?.legacy
                ? 'Paystack (existing setup)'
                : query.data?.provider === 'opay'
                  ? 'OPay'
                  : 'Paystack'}
            </strong>
            {!query.data?.legacy && query.data?.mode && (
              <Badge tone={query.data.mode === 'live' ? 'success' : 'warning'} size="sm">
                {query.data.mode === 'live' ? 'Live' : 'Test mode'}
              </Badge>
            )}
            <span className="text-xs text-ink-500">Saved keys are never shown.</span>
          </div>
          <fieldset disabled={save.isPending} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="New active gateway">
                <Select
                  value={provider}
                  onChange={(e) => {
                    setProvider(e.target.value as Gateway['provider']);
                    setSecret('');
                    setPublicKey('');
                    save.reset();
                  }}
                >
                  <option value="paystack">Paystack</option>
                  <option value="opay">OPay</option>
                </Select>
              </FormField>
              <FormField label="Payment mode">
                <Select value={mode} onChange={(e) => setMode(e.target.value as 'test' | 'live')}>
                  <option value="test">Test / sandbox</option>
                  <option value="live">Live</option>
                </Select>
              </FormField>
            </div>
            {provider === 'opay' && (
              <>
                <FormField label="OPay merchant ID" required>
                  <Input
                    required
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    autoComplete="off"
                  />
                </FormField>
                <FormField label="OPay public key" required>
                  <PasswordInput
                    required
                    value={publicKey}
                    onChange={(e) => setPublicKey(e.target.value)}
                    autoComplete="new-password"
                  />
                </FormField>
                <p className="text-sm text-ink-600">
                  Use your Nigeria OPay Checkout merchant credentials. Configure your merchant
                  webhook to your backend address followed by /api/v1/payments/opay/webhook/.
                </p>
              </>
            )}
            <FormField
              label={provider === 'opay' ? 'OPay private key' : 'Paystack secret key'}
              required
            >
              <PasswordInput
                required
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                autoComplete="new-password"
              />
            </FormField>
            <p className="text-sm text-ink-500">
              Saving activates this account for new purchases. Test credentials cannot collect real
              payments. Saving does not verify provider access; complete a sandbox purchase before
              going live.
            </p>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Saving…' : 'Save and activate gateway'}
            </Button>
          </fieldset>
          {save.isError && (
            <Alert tone="danger">
              The gateway could not be saved. Check all credentials and the selected mode. Staging
              accepts test accounts only.
            </Alert>
          )}
          {save.isSuccess && (
            <Alert tone="success">Gateway saved for new customer purchases.</Alert>
          )}
        </form>
      )}
    </SettingsCard>
  );
}
