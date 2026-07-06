import { Fragment } from 'react'
import { Icon } from './ui'

// Live, clickable pipeline stepper. Unlike the reference's static "how it thinks"
// flow diagram, each stop here navigates and shows a real count computed from the
// current evaluation. Kept decoupled from App's ScreenId union (ids are plain
// strings) so it has no import cycle with App.tsx.
export interface StepCounts {
  active: number
  checklistItems: number
  gaps: number
  flags: number
  totalClaims: number
  pendingClaims: number
}

interface Step {
  id: string
  label: string
  cap: string
  count: number
}

export function PipelineStepper({
  current,
  onGo,
  counts,
}: {
  current: string
  onGo: (id: string) => void
  counts: StepCounts
}) {
  const steps: Step[] = [
    { id: 'rules', label: 'Applicability', cap: 'factors in scope', count: counts.active },
    { id: 'checklist', label: 'Checklist', cap: 'evidence to request', count: counts.checklistItems },
    { id: 'intake', label: 'Evidence Intake', cap: 'documents → claims', count: counts.totalClaims },
    { id: 'review', label: 'Claims Review', cap: 'accept / reject', count: counts.pendingClaims },
    { id: 'data', label: 'Evidence Register', cap: 'submitted + assessed', count: counts.gaps },
    { id: 'validation', label: 'Gaps & Validation', cap: 'gaps + threshold check', count: counts.flags },
  ]
  const currentIdx = steps.findIndex((s) => s.id === current)

  return (
    <nav className="stepper" aria-label="Evidence pipeline">
      {steps.map((s, i) => {
        const state = i === currentIdx ? 'active' : i < currentIdx ? 'done' : ''
        return (
          <Fragment key={s.id}>
            <button
              className={`stepper-step ${state}`}
              onClick={() => onGo(s.id)}
              title={`Go to ${s.label}`}
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <span className="step-mark">{state === 'done' ? '✓' : i + 1}</span>
              <span className="step-body">
                <span className="step-label">{s.label}</span>
                <span className="step-cap">{s.cap}</span>
              </span>
              <span className="step-count">{s.count}</span>
            </button>
            {i < steps.length - 1 && (
              <span className="step-arrow" aria-hidden="true">
                <Icon name="chevron" size={14} />
              </span>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
