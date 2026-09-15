import { useRef, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, FormField, Input, Select } from '@/components/ui';
import { Alert, QueryBoundary } from '@/components/feedback';
import { Pagination } from '@/components/data';
import { usePrincipal } from '@/app/auth/useAuth';
import { usePlanOptions } from '@/features/plans/queries';
import { formatKobo, koboToNairaInput, parseNairaToKobo } from '@/lib/formatting/money';
import { ApiError } from '@/services/api/errors';
import type { AgentProfile } from '@/types/api';
import {
  creditApi,
  creditQuote,
  readPendingCredit,
  type CreditAccount,
  type CreditBatch,
  type CreditCommand,
} from '../creditApi';

export function AgentCreditPanel({ agent }: { agent: AgentProfile }) {
  const principal = usePrincipal();
  const account = useQuery({
    queryKey: ['agent-credit', agent.id, 'account'],
    queryFn: () => creditApi.account(agent.id),
    enabled: principal.kind === 'member' && principal.role === 'owner',
  });
  if (principal.kind !== 'member' || principal.role !== 'owner') return null;
  return (
    <QueryBoundary
      skeleton={<p>Loading credit records...</p>}
      query={account}
      errorTitle="Could not load credit account"
    >
      {(data) => (
        <CreditControls
          key={`${principal.user.id}:${principal.tenantId}:${agent.id}`}
          agent={agent}
          account={data}
          storageKey={`agent-credit:${principal.user.id}:${principal.tenantId}:${agent.id}`}
        />
      )}
    </QueryBoundary>
  );
}

function CreditControls({
  agent,
  account,
  storageKey,
}: {
  agent: AgentProfile;
  account: CreditAccount;
  storageKey: string;
}) {
  const client = useQueryClient();
  const [page, setPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const batches = useQuery({
    queryKey: ['agent-credit', agent.id, 'batches', page],
    queryFn: () => creditApi.batches(agent.id, page),
  });
  const history = useQuery({
    queryKey: ['agent-credit', agent.id, 'history', historyPage],
    queryFn: () => creditApi.history(agent.id, historyPage),
  });
  const plans = usePlanOptions();
  const [mode, setMode] = useState<'settings' | 'issue' | 'repay' | 'reverse'>('settings');
  const [limit, setLimit] = useState(koboToNairaInput(account.credit_limit));
  const [enabled, setEnabled] = useState(account.is_active);
  const [expected, setExpected] = useState(account);
  const [planId, setPlanId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [selected, setSelected] = useState<CreditBatch | null>(null);
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [method, setMethod] = useState('bank_transfer');
  const [date, setDate] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [saved] = useState(() => {
    try {
      return { pending: readPendingCredit(storageKey), error: '' };
    } catch {
      return {
        pending: null,
        error:
          'Saved request could not be read. Restore browser storage before submitting credit changes.',
      };
    }
  });
  const [pending, setPending] = useState<CreditCommand | null>(saved.pending);
  const plan = plans.data?.find((row) => row.id === Number(planId));
  const quote = plan ? creditQuote(plan.price, agent.commission_rate, Number(quantity)) : 0;

  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['agent-credit', agent.id] }),
      client.invalidateQueries({ queryKey: ['vouchers'] }),
      client.invalidateQueries({ queryKey: ['agents'] }),
    ]);
  }

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    if (lock.current || saved.error) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      if (mode === 'settings' && !pending) {
        const creditLimit = parseNairaToKobo(limit);
        if (creditLimit === null || creditLimit > 2147483647)
          throw new Error('Enter a valid credit limit.');
        const result = await creditApi.configure(agent.id, {
          credit_limit: creditLimit,
          is_active: enabled,
          expected,
          note,
        });
        setExpected(result);
      } else {
        let command = pending;
        if (!command) {
          if (!confirmed) throw new Error('Confirm the credit operation before continuing.');
          const payload: CreditCommand['payload'] = { request_key: crypto.randomUUID() };
          if (mode === 'issue') {
            if (
              !plan ||
              !Number.isInteger(Number(quantity)) ||
              Number(quantity) < 1 ||
              Number(quantity) > 100
            )
              throw new Error('Choose a plan and quantity from 1 to 100.');
            Object.assign(payload, {
              plan_id: plan.id,
              quantity: Number(quantity),
              expected_total: quote,
              due_date: date || null,
              note,
            });
          } else {
            if (!selected) throw new Error('Choose an allocation from the list.');
            payload.batch_id = selected.id;
            if (mode === 'repay') {
              const paid = parseNairaToKobo(amount);
              if (paid === null || paid <= 0 || paid > selected.outstanding)
                throw new Error('Enter an amount within the remaining debt.');
              Object.assign(payload, {
                amount: paid,
                external_reference: reference,
                method,
                received_on: date,
                note,
              });
            } else
              Object.assign(payload, {
                reason: note,
                expected_outstanding: selected.outstanding,
                expected_repaid: selected.repaid,
              });
          }
          command = { kind: mode as CreditCommand['kind'], payload };
          // Persist before the request; do not send if browser storage is unavailable.
          sessionStorage.setItem(storageKey, JSON.stringify(command));
          setPending(command);
        }
        await creditApi.command(agent.id, command);
        sessionStorage.removeItem(storageKey);
        setPending(null);
        setSelected(null);
        setMode('settings');
        setConfirmed(false);
        setNote('');
        setAmount('');
        setReference('');
      }
      setSuccess('Credit records saved.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save credit changes.');
      // Only definite validation rejection can release the saved operation automatically.
      if (cause instanceof ApiError && cause.status === 400) {
        sessionStorage.removeItem(storageKey);
        setPending(null);
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  function choose(batch: CreditBatch, action: 'repay' | 'reverse') {
    setSelected(batch);
    setMode(action);
    setConfirmed(false);
    setNote('');
    setDate('');
    setError('');
  }

  return (
    <div className="space-y-6">
      <p>
        Credit limit: <strong>{formatKobo(account.credit_limit)}</strong> · Amount owed:{' '}
        <strong>{formatKobo(account.current_balance)}</strong> · Available:{' '}
        <strong>{formatKobo(account.available_credit)}</strong>
      </p>
      {account.requires_review && (
        <Alert tone="warning">
          Historical balance or ledger needs reconciliation before credit transactions can continue.
        </Alert>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      {saved.error && <Alert tone="danger">{saved.error}</Alert>}
      {success && <Alert tone="success">{success}</Alert>}
      {pending && (
        <Alert tone="warning">
          A {pending.kind} request is awaiting confirmation. Retry the saved request to retrieve its
          result; do not enter it again.
          <Button type="button" disabled={busy} onClick={() => void submit()}>
            Retry saved request
          </Button>
        </Alert>
      )}
      <form onSubmit={(event) => void submit(event)} className="max-w-xl space-y-4">
        <fieldset disabled={busy || !!pending || !!saved.error} className="space-y-4">
          <FormField label="Credit action">
            <Select
              id="credit-mode"
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as typeof mode);
                setConfirmed(false);
              }}
            >
              <option value="settings">Configure credit limit</option>
              <option value="issue">Issue vouchers on credit</option>
              {selected && (
                <>
                  <option value="repay">Record repayment for allocation #{selected.id}</option>
                  <option value="reverse">Cancel allocation #{selected.id}</option>
                </>
              )}
            </Select>
          </FormField>
          {mode === 'settings' && (
            <>
              <FormField label="Credit limit (naira)">
                <Input
                  id="credit-limit"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  inputMode="decimal"
                  required
                />
              </FormField>
              <Checkbox
                label="Allow new credit allocations"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
              />
              <p>Changing the limit does not change the amount owed.</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setExpected(account);
                  setLimit(koboToNairaInput(account.credit_limit));
                  setEnabled(account.is_active);
                }}
              >
                Use latest loaded settings
              </Button>
            </>
          )}
          {mode === 'issue' && (
            <>
              {plans.isError && (
                <Alert tone="danger">
                  Plans could not be loaded.{' '}
                  <Button type="button" onClick={() => void plans.refetch()}>
                    Retry
                  </Button>
                </Alert>
              )}
              <FormField label="Plan">
                <Select
                  id="credit-plan"
                  required
                  value={planId}
                  onChange={(e) => {
                    setPlanId(e.target.value);
                    setConfirmed(false);
                  }}
                >
                  <option value="">{plans.isPending ? 'Loading plans...' : 'Choose a plan'}</option>
                  {plans.data
                    ?.filter((row) => row.agent_enabled)
                    .map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.name} · {formatKobo(row.price)}
                      </option>
                    ))}
                </Select>
              </FormField>
              <FormField label="Quantity">
                <Input
                  id="credit-quantity"
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    setConfirmed(false);
                  }}
                />
              </FormField>
              <p>
                Debt to add after {agent.commission_rate}% commission:{' '}
                <strong>{formatKobo(quote)}</strong>
              </p>
            </>
          )}
          {mode === 'repay' && (
            <>
              <p>
                Allocation #{selected?.id} owes {formatKobo(selected?.outstanding)}. Record money
                already received; this does not charge a payment provider.
              </p>
              <FormField label="Amount received (naira)">
                <Input
                  id="credit-amount"
                  required
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </FormField>
              <FormField label="Receipt reference (unique within your business)">
                <Input
                  id="credit-reference"
                  required
                  maxLength={100}
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </FormField>
              <FormField label="Payment method">
                <Select
                  id="credit-method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="bank_transfer">Bank transfer</option>
                  <option value="cash">Cash</option>
                  <option value="other">Other</option>
                </Select>
              </FormField>
            </>
          )}
          {(mode === 'issue' || mode === 'repay') && (
            <FormField label={mode === 'issue' ? 'Due date (optional)' : 'Date received'}>
              <Input
                id="credit-date"
                type="date"
                required={mode === 'repay'}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </FormField>
          )}
          {mode === 'reverse' && (
            <Alert tone="warning">
              Cancel all {selected?.quantity} vouchers in allocation #{selected?.id}, provided none
              has been used. Clear {formatKobo(selected?.outstanding)} unpaid debt. Keep{' '}
              {formatKobo(selected?.repaid)} already repaid. No refund or wallet credit will be
              issued.
            </Alert>
          )}
          <FormField label={mode === 'reverse' ? 'Reason for cancellation' : 'Note'}>
            <Input
              id="credit-note"
              required={mode === 'reverse' || mode === 'settings'}
              maxLength={200}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </FormField>
          {mode !== 'settings' && (
            <Checkbox
              label={
                mode === 'reverse'
                  ? 'I confirm cancellation without a refund.'
                  : 'I confirm the amounts and details above.'
              }
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
          )}
          <Button
            type="submit"
            disabled={mode !== 'settings' && (!confirmed || account.requires_review)}
          >
            Save{' '}
            {mode === 'settings'
              ? 'credit settings'
              : mode === 'issue'
                ? 'credit allocation'
                : mode === 'repay'
                  ? 'repayment'
                  : 'cancellation'}
          </Button>
        </fieldset>
      </form>
      <section aria-label="Credit allocations" className="space-y-3">
        <h3 className="font-semibold">Credit allocations</h3>
        <QueryBoundary
          skeleton={<p>Loading credit records...</p>}
          query={batches}
          errorTitle="Could not load allocations"
        >
          {(data) => (
            <>
              {!data.count && <p>No credit allocations recorded in this workflow.</p>}
              {data.results.map((batch) => (
                <div key={batch.id} className="space-y-2 rounded border border-border p-3">
                  <p>
                    #{batch.id} · {batch.quantity} vouchers · Total {formatKobo(batch.total)} ·
                    Repaid {formatKobo(batch.repaid)} · Outstanding {formatKobo(batch.outstanding)}
                  </p>
                  <p>
                    {batch.reversed_at
                      ? `Cancelled: ${batch.reversal_reason}`
                      : batch.due_date
                        ? `Due ${batch.due_date}`
                        : 'No due date'}
                  </p>
                  {!batch.reversed_at && (
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy || !!pending || batch.outstanding === 0}
                        onClick={() => choose(batch, 'repay')}
                      >
                        Record repayment
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={busy || !!pending}
                        onClick={() => choose(batch, 'reverse')}
                      >
                        Cancel unused allocation
                      </Button>
                    </div>
                  )}
                </div>
              ))}
              <Pagination
                count={data.count}
                page={page}
                totalPages={data.total_pages}
                pageSize={10}
                onPageChange={setPage}
              />
            </>
          )}
        </QueryBoundary>
      </section>
      <section aria-label="Credit history" className="space-y-3">
        <h3 className="font-semibold">Credit history</h3>
        <QueryBoundary
          skeleton={<p>Loading credit records...</p>}
          query={history}
          errorTitle="Could not load credit history"
        >
          {(data) => (
            <>
              {!data.count && <p>No credit movements recorded.</p>}
              {data.results.map((entry) => (
                <p key={entry.id}>
                  {entry.created_at.slice(0, 10)} · {formatKobo(entry.amount)} · {entry.description}
                  {entry.evidence &&
                    ` · Allocation #${entry.evidence.batch_id} · ${entry.evidence.external_reference || entry.evidence.kind}`}
                </p>
              ))}
              <Pagination
                count={data.count}
                page={historyPage}
                totalPages={data.total_pages}
                pageSize={10}
                onPageChange={setHistoryPage}
              />
            </>
          )}
        </QueryBoundary>
      </section>
    </div>
  );
}
