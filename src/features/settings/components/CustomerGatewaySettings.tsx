import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePrincipal } from '@/app/auth/useAuth';
import { http } from '@/services/api/http';
import { Button, FormField, Input, PasswordInput, Select } from '@/components/ui';
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
  const [mode, setMode] = useState<'test' | 'live'>('test');
  const [secret, setSecret] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [merchant, setMerchant] = useState('');
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
      description="Choose one gateway for new storefront, WhatsApp and device purchases. Earlier purchases keep their original payment account. Only the workspace owner can change this setting."
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
          <p className="text-sm text-ink-600">
            Current:{' '}
            {query.data?.legacy
              ? 'Existing Paystack configuration'
              : `${query.data?.provider === 'opay' ? 'OPay' : 'Paystack'} (${query.data?.mode})`}
            . Saved credentials are never displayed.
          </p>
          <fieldset disabled={save.isPending} className="space-y-4">
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
