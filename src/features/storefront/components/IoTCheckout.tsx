import { useRef, useState } from 'react';
import { Button, FormField, Input } from '@/components/ui';
import { Alert } from '@/components/feedback';
import { http } from '@/services/api/http';
import { errorMessage, isApiError } from '@/services/api/errors';
import { newIdempotencyKey } from '@/lib/utilities/idempotency';
import { formatKobo } from '@/lib/formatting/money';
import type { PublicPlan } from '@/types/api';
import { pendingCheckout } from '../pendingCheckout';
import type { CheckoutStart } from '../api';
import { checkoutUrl } from '../checkoutUrl';

export function IoTCheckout({ plan, slug }: { plan: PublicPlan; slug: string }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [reference, setReference] = useState('');
  const [fields, setFields] = useState({
    email: '',
    name: '',
    phone: '',
    device_name: '',
    mac_address: '',
    renewal_token: '',
  });
  const key = useRef(newIdempotencyKey('iot-buy'));
  return (
    <form
      aria-label="Device purchase"
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setBusy(true);
        setSubmitted(true);
        setError('');
        try {
          const result = await http.post<CheckoutStart>(
            '/buy/iot/',
            { ...fields, plan_id: plan.id },
            { anonymous: true, tenantId: null, idempotencyKey: key.current },
          );
          pendingCheckout.save({
            kind: 'iot',
            reference: result.reference,
            slug,
            planName: plan.name,
            amount: result.amount ?? plan.price,
          });
          window.location.assign(checkoutUrl(result.authorization_url));
        } catch (failure) {
          setError(errorMessage(failure));
          if (
            isApiError(failure) &&
            failure.body &&
            typeof failure.body === 'object' &&
            'reference' in failure.body &&
            typeof failure.body.reference === 'string'
          ) {
            setReference(failure.body.reference);
            pendingCheckout.save({
              kind: 'iot',
              reference: failure.body.reference,
              slug,
              planName: plan.name,
              amount: plan.price,
            });
          }
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        This purchase grants access to one registered device. For a renewal, paste the renewal token
        from your previous successful purchase. Unused time is retained.
      </p>
      {error && (
        <Alert tone="danger">
          {error} Your retry uses the same request. If charged, check the original payment before
          starting another purchase.
        </Alert>
      )}
      {reference && (
        <a
          className="text-brand-700 underline"
          href={`/pay/result?reference=${encodeURIComponent(reference)}`}
        >
          Check this payment
        </a>
      )}
      {(['email', 'name', 'phone', 'device_name', 'mac_address', 'renewal_token'] as const).map(
        (name) => (
          <FormField
            key={name}
            label={
              {
                email: 'Email address',
                name: 'Your name',
                phone: 'Phone',
                device_name: 'Device name',
                mac_address: 'MAC address',
                renewal_token: 'Renewal token (existing devices)',
              }[name]
            }
            required={['email', 'device_name', 'mac_address'].includes(name)}
          >
            <Input
              type={name === 'email' ? 'email' : 'text'}
              required={['email', 'device_name', 'mac_address'].includes(name)}
              value={fields[name]}
              disabled={submitted}
              maxLength={
                name === 'renewal_token'
                  ? 1024
                  : name === 'mac_address'
                    ? 32
                    : name === 'phone'
                      ? 20
                      : 200
              }
              onChange={(event) => setFields({ ...fields, [name]: event.target.value })}
            />
          </FormField>
        ),
      )}
      <Button type="submit" loading={busy}>
        {submitted ? 'Retry same purchase' : `Pay ${formatKobo(plan.price)}`}
      </Button>
      {submitted && !reference && !busy && (
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            // A new intent is explicit. Do not automatically turn an uncertain attempt into a second charge.
            setSubmitted(false);
            key.current = newIdempotencyKey('iot-buy');
            setError('');
          }}
        >
          Review details for a new attempt
        </Button>
      )}
    </form>
  );
}
