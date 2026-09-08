import { useEffect, useState } from 'react';
import { RegistrationLayout } from '../registration/RegistrationLayout';
import { VerifyRegistrationEmail } from '../registration/VerifyRegistrationEmail';
import { CreateWorkspace } from '../registration/CreateWorkspace';
import { WorkspaceReady } from '../registration/WorkspaceReady';
import type { EmailProof, WorkspaceReady as ReadyData } from '../registration/api';

type Step =
  | { kind: 'verify'; email: string }
  | { kind: 'create'; proof: EmailProof }
  | { kind: 'ready'; result: ReadyData };
export default function RegisterPage() {
  const [step, setStep] = useState<Step>({ kind: 'verify', email: '' });
  useEffect(() => {
    document.title = 'Create workspace - Yarotech RADIUS';
  }, []);
  return (
    <RegistrationLayout step={step.kind === 'verify' ? 1 : step.kind === 'create' ? 2 : 3}>
      {step.kind === 'verify' && (
        <VerifyRegistrationEmail
          initialEmail={step.email}
          onVerified={(proof) => setStep({ kind: 'create', proof })}
        />
      )}
      {step.kind === 'create' && (
        <CreateWorkspace
          proof={step.proof}
          onReady={(result) => setStep({ kind: 'ready', result })}
          onBack={() => setStep({ kind: 'verify', email: step.proof.email })}
        />
      )}
      {step.kind === 'ready' && <WorkspaceReady result={step.result} />}
    </RegistrationLayout>
  );
}
