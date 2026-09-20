import { Dialog } from '@/components/ui';
import type { InternetPlan } from '@/types/api';
import { PlanForm } from './PlanForm';
import { Plus } from 'lucide-react';
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
  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="xl"
      className="service-plan-dialog"
      title={
        <span className="plan-dialog-title">
          <span className="plan-dialog-icon">
            <Plus aria-hidden />
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
      {open && <PlanForm {...(plan ? { plan } : {})} onSaved={onSaved} onCancel={onClose} />}
    </Dialog>
  );
}
