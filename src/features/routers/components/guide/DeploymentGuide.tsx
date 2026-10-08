import { Fragment, useState } from 'react';
import { Cable, ChevronDown, Lightbulb } from 'lucide-react';
import { CopyButton } from '@/components/ui';
import { cn } from '@/lib/utilities/cn';
import { DEPLOYMENT_GUIDES, GOOD_TO_KNOW, type GuideId, type GuideStep } from './deploymentGuides';

/** Renders "**WinBox menu**" segments as <strong>. */
function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split('**').map((part, index) =>
        index % 2 === 1 ? (
          <strong key={index} className="font-semibold text-ink-900">
            {part}
          </strong>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}

function Commands({ commands }: { commands: string[] }) {
  const all = commands.join('\n');
  return (
    <div className="rounded-control border border-[#1e293b] bg-[#0b1220]">
      <div className="flex items-center justify-between gap-2 border-b border-[#1e293b] px-3 py-1.5">
        <span className="text-xs font-medium text-[#94a3b8]">Or paste in New Terminal</span>
        <CopyButton
          value={all}
          label={commands.length > 1 ? 'Copy terminal commands' : 'Copy terminal command'}
          className="text-[#e2e8f0] hover:bg-white/10"
        />
      </div>
      <pre className="overflow-x-auto px-3 py-2.5 font-mono text-xs leading-relaxed text-[#e2e8f0]">
        {all}
      </pre>
    </div>
  );
}

function Fields({ fields }: { fields: [string, string][] }) {
  return (
    <table className="w-full overflow-hidden rounded-control border border-border text-sm">
      <caption className="sr-only">Values for the Add router form</caption>
      <thead className="bg-surface-muted text-left text-xs text-ink-500">
        <tr>
          <th scope="col" className="px-3 py-2 font-medium">
            Field
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Enter
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {fields.map(([label, value]) => (
          <tr key={label}>
            <th scope="row" className="px-3 py-2 text-left font-normal text-ink-600">
              {label}
            </th>
            <td className="px-3 py-2">
              {/* Typed values (no spaces) get a copy button; option names are chosen, not typed. */}
              {value.includes(' ') ? (
                <span className="font-semibold text-ink-900">{value}</span>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <code className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-[13px] font-semibold text-brand-800">
                    {value}
                  </code>
                  <CopyButton value={value} label={`Copy ${label}`} size="icon" />
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Step({ step, number }: { step: GuideStep; number: number }) {
  return (
    <li className="relative pl-10">
      <span
        aria-hidden
        className="absolute top-0 left-0 flex size-7 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
      >
        {number}
      </span>
      <h4 className="pt-0.5 text-sm font-semibold text-ink-900">{step.title}</h4>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-ink-700">
        {step.points.map((point) => (
          <li key={point}>
            <Rich text={point} />
          </li>
        ))}
      </ul>
      {step.fields && (
        <div className="mt-3">
          <Fields fields={step.fields} />
        </div>
      )}
      {step.commands && (
        <div className="mt-3">
          <Commands commands={step.commands} />
        </div>
      )}
      {step.note && <p className="mt-2 text-xs text-ink-500">{step.note}</p>}
    </li>
  );
}

/** Choose a deployment, then follow numbered WinBox steps with the exact Add router values. */
export function DeploymentGuide() {
  const [selected, setSelected] = useState<GuideId>('default');
  const guide = DEPLOYMENT_GUIDES.find((item) => item.id === selected)!;
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink-900">
          Which setup matches your router?
        </legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {DEPLOYMENT_GUIDES.map((item) => {
            const checked = item.id === selected;
            return (
              <label
                key={item.id}
                className={cn(
                  'flex cursor-pointer flex-col rounded-card border px-3 py-2.5 transition-colors has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-brand-600',
                  checked
                    ? 'border-brand-500 bg-brand-50'
                    : 'border-border hover:border-border-strong',
                )}
              >
                <input
                  type="radio"
                  name="router-setup-type"
                  className="sr-only"
                  checked={checked}
                  onChange={() => setSelected(item.id)}
                />
                <span className="text-sm font-semibold text-ink-900">{item.label}</span>
                <span className="text-xs text-ink-600">{item.bestFor}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="text-sm text-ink-600">{guide.summary}</p>

      <section aria-label="Wiring" className="rounded-card border border-border p-4">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-ink-900">
          <Cable aria-hidden className="size-4 text-ink-500" />
          Wiring
        </h4>
        <dl className="mt-3 grid gap-2 sm:grid-cols-3">
          {guide.wiring.map(([port, connection]) => (
            <div key={port} className="rounded-control bg-surface-muted px-3 py-2">
              <dt className="font-mono text-xs font-semibold text-brand-700">{port}</dt>
              <dd className="text-sm text-ink-700">{connection}</dd>
            </div>
          ))}
        </dl>
      </section>

      <ol aria-label={`${guide.label} steps`} className="space-y-6">
        {guide.steps.map((step, index) => (
          <Step key={step.title} step={step} number={index + 1} />
        ))}
      </ol>

      <section aria-labelledby="router-guide-tips" className="rounded-card border border-border">
        <h4
          id="router-guide-tips"
          className="flex items-center gap-2 border-b border-border px-4 py-3 text-sm font-semibold text-ink-900"
        >
          <Lightbulb aria-hidden className="size-4 text-ink-500" />
          Good to know
        </h4>
        <ul className="divide-y divide-border">
          {GOOD_TO_KNOW.map((tip) => (
            <li key={tip.title}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-2.5 text-sm text-ink-900 hover:bg-surface-muted [&::-webkit-details-marker]:hidden">
                  {tip.title}
                  <ChevronDown
                    aria-hidden
                    className="size-4 shrink-0 text-ink-400 transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="space-y-3 px-4 pb-3 text-sm text-ink-700">
                  <p>
                    <Rich text={tip.text} />
                  </p>
                  {tip.commands && <Commands commands={tip.commands} />}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
