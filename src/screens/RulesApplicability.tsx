import { useState } from 'react'
import { useStore } from '../state/store'
import decisionFactors from '../data/decisionFactors.json'
import { ApplicabilityPill, Card, Icon, Kpi } from '../components/ui'
import type { DFCode, FactorApplicability } from '../engine/types'

export default function RulesApplicability() {
  const { result } = useStore()
  const app = result.applicability
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(decisionFactors.map((d) => [d.code, true])))
  const [selected, setSelected] = useState<FactorApplicability | null>(null)

  const count = (s: string) => app.filter((a) => a.status === s).length

  return (
    <div className="col gap16">
      <div className="kpi-row">
        <Kpi num={count('Mandatory')} label="Mandatory" />
        <Kpi num={count('Conditional Active')} label="Conditional Active" accent />
        <Kpi num={count('Optional')} label="Optional" />
        <Kpi num={count('Not Applicable')} label="Not Applicable" />
        <Kpi num={43 - count('Not Applicable')} label="In-scope (denominator)" />
      </div>

      {decisionFactors.map((df) => {
        const rows = app.filter((a) => a.df === (df.code as DFCode))
        const isOpen = open[df.code]
        return (
          <Card key={df.code}>
            <div className="collapse-head" onClick={() => setOpen((o) => ({ ...o, [df.code]: !o[df.code] }))}>
              <span className={`caret ${isOpen ? 'open' : ''}`}><Icon name="chevron" size={15} /></span>
              <strong style={{ fontFamily: 'var(--serif)' }}>{df.code} · {df.name}</strong>
              <span className="muted" style={{ fontSize: 12 }}>{rows.length} factors</span>
              <span style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 12 }}>{rows.filter((r) => r.status === 'Mandatory').length} mandatory</span>
            </div>
            {isOpen && (
              <div className="table-wrap">
                <table className="data">
                  <thead><tr><th>Code</th><th>Leaf factor</th><th>Canonical field</th><th>Base</th><th>Status</th><th></th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.code} className={`row-clickable ${r.status === 'Not Applicable' ? 'na-row' : ''}`} onClick={() => setSelected(r)}>
                        <td className="mono muted">{r.code}</td>
                        <td><strong style={{ fontWeight: 600 }}>{r.name}</strong></td>
                        <td className="mono muted">{r.field}</td>
                        <td className="muted">{r.base}</td>
                        <td><ApplicabilityPill status={r.status} /></td>
                        <td><span className="muted" style={{ fontSize: 11 }}>trace ›</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )
      })}

      {selected && <TraceDrawer factor={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function TraceDrawer({ factor, onClose }: { factor: FactorApplicability; onClose: () => void }) {
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head between">
          <div>
            <div className="muted mono" style={{ fontSize: 12 }}>{factor.code} · {factor.df}</div>
            <h3 style={{ fontSize: 18, marginTop: 4 }}>{factor.name}</h3>
            <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>{factor.field}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="drawer-body">
          <div className="between" style={{ marginBottom: 16 }}>
            <span className="muted">Base status: <strong>{factor.base}</strong></span>
            <ApplicabilityPill status={factor.status} />
          </div>
          <div className="section-label">Reason trace — rules evaluated in order</div>
          <ul className="trace">
            {factor.reason.map((step, i) => (
              <li key={i}>
                <span className="trace-step">{i + 1}</span>
                <div>
                  <div className="trace-rule">{step.rule}</div>
                  <div className="trace-detail">{step.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="divider" />
          <p className="muted" style={{ fontSize: 12 }}>
            Rules fire in fixed precedence: Not Applicable → Mandatory → Conditional → Default, then Criticality and Strategy upgrades.
            The first rule that fires sets the status; a Not Applicable result is final and cannot be upgraded.
          </p>
        </div>
      </aside>
    </>
  )
}
