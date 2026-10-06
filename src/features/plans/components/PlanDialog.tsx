import { useState } from 'react';
import { ConfirmDialog, Dialog } from '@/components/ui';
import type { InternetPlan } from '@/types/api';
import { PlanForm } from './PlanForm';
import { Pencil, Plus } from 'lucide-react';
import '../plans.css';

export function PlanDialog({
  open,
  plan,
  onClose,
  onSaved,
}: {
  open: boolean;
  plan?: InternetPlan;
  onClose: () => void;
  onSaved: (plan: InternetPlan) => void;
}) {
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  function requestClose() {
    if (busy) return;
    if (dirty) {
      setConfirmDiscard(true);
      return;
    }
    onClose();
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={requestClose}
        size="lg"
        dismissible={!busy}
        closeOnBackdropClick={false}
        className="service-plan-dialog"
        title={
          <span className="plan-dialog-title">
            <span className="plan-dialog-icon">
              {plan ? <Pencil aria-hidden /> : <Plus aria-hidden />}
            </span>
            {plan ? `Edit ${plan.name}` : 'Create New Hotspot Plan'}
          </span>
        }
        description={
          plan
            ? 'Changes apply to future access. Issued vouchers keep their saved duration, price, data and speed terms.'
            : 'Configure access, pricing and bandwidth for your internet catalogue.'
        }
      >
        {open && (
          <PlanForm
            {...(plan ? { plan } : {})}
            onSaved={onSaved}
            onCancel={requestClose}
            onDirtyChange={setDirty}
            onBusyChange={setBusy}
          />
        )}
      </Dialog>
      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        tone="danger"
        title={plan ? `Discard changes to ${plan.name}?` : 'Discard new plan?'}
        description="Your entered details will be lost. This cannot be undone."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
      />
    </>
  );
}
