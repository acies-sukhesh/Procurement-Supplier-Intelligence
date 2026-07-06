import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { Card, LabelPill, SUPPLIER_COLORS } from '../components/ui'
import type { ApplicabilityStatus } from '../engine/types'

export default function Scenario() {
  const { result, baseline, commitBaseline } = useStore()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  const baseApp = new Map(baseline.applicability.map((a) => [a.code, a]))
  const changedFactors = result.applicability
    .map((a) => ({ now: a, was: baseApp.get(a.code)! }))
    .filter((p) => p.was && p.now.status !== p.was.status)

  const supplierDeltas = result.suppliers.map((s) => {
    const b = baseline.suppliers.find((x) => x.id === s.id)!
    return { id: s.id, name: s.name, now: s.readiness, was: b.readiness, delta: s.readiness - b.readiness, nowLabel: s.label, wasLabel: b.label }
  })

  const same = JSON.stringify(baseline.context) === JSON.stringify(result.context)

  return (
    <div className="col gap16">
      <Card className="card-pad">
        <div className="between wrap gap12">
          <div>
            <div className="section-label" style={{ margin: 0 }}>Baseline strategy: {baseline.strategy.name} · Current strategy: {result.strategy.name}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              {same ? 'Current request matches the saved baseline. Change inputs on Evaluation Request, then compare here.' : `${changedFactors.length} factor(s) changed applicability since the baseline snapshot.`}
            </div>
          </div>
          <button className="chip-btn active" onClick={() => { commitBaseline(); setToast('Baseline updated to the current request.') }}>Save current as baseline</button>
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card>
          <div className="card-head"><div className="card-title">Per-supplier readiness delta</div></div>
          <div className="card-pad col gap12">
            {supplierDeltas.map((d) => {
              const pct = (d.delta * 100)
              const w = Math.min(Math.abs(pct), 50)
              return (
                <div key={d.id}>
                  <div className="between" style={{ marginBottom: 4 }}>
                    <span className="flex center gap8"><span style={{ width: 9, height: 9, borderRadius: 3, background: SUPPLIER_COLORS[d.id] }} /><strong>{d.id}</strong></span>
                    <span className="flex center gap8">
                      <span className="muted mono" style={{ fontSize: 12 }}>{(d.was * 100).toFixed(0)}% → {(d.now * 100).toFixed(0)}%</span>
                      <span className={pct > 0.05 ? 'delta-up' : pct < -0.05 ? 'delta-down' : 'delta-na'}>{pct > 0.05 ? '▲' : pct < -0.05 ? '▼' : '–'} {Math.abs(pct).toFixed(1)}%</span>
                    </span>
                  </div>
                  <div style={{ position: 'relative', height: 8, background: 'var(--na-bg)', borderRadius: 5 }}>
                    <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border)' }} />
                    <div style={{ position: 'absolute', left: pct >= 0 ? '50%' : `${50 - w}%`, width: `${w}%`, top: 0, bottom: 0, borderRadius: 5, background: pct >= 0 ? 'var(--pass)' : 'var(--below)' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        <Card>
          <div className="card-head"><div className="card-title">Label transitions</div></div>
          <div className="table-wrap">
            <table className="data">
              <thead><tr><th>Supplier</th><th>Baseline</th><th></th><th>Current</th></tr></thead>
              <tbody>
                {supplierDeltas.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{d.id}</strong></td>
                    <td><LabelPill label={d.wasLabel} /></td>
                    <td className="muted">→</td>
                    <td>{d.nowLabel === d.wasLabel ? <span className="muted" style={{ fontSize: 12 }}>unchanged</span> : <LabelPill label={d.nowLabel} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card>
        <div className="card-head"><div className="card-title">Factor applicability changes</div><div className="card-hint">{changedFactors.length} changed</div></div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Code</th><th>Factor</th><th>Baseline</th><th></th><th>Current</th><th>Change</th></tr></thead>
            <tbody>
              {changedFactors.length === 0 && <tr><td colSpan={6} className="muted" style={{ textAlign: 'center', padding: 24 }}>No applicability changes versus the baseline.</td></tr>}
              {changedFactors.map((p) => (
                <tr key={p.now.code}>
                  <td className="mono muted">{p.now.code}</td>
                  <td><strong style={{ fontWeight: 600 }}>{p.now.name}</strong></td>
                  <td className="muted">{p.was.status}</td>
                  <td className="muted">→</td>
                  <td><strong style={{ fontWeight: 600 }}>{p.now.status}</strong></td>
                  <td>{deltaBadge(p.was.status, p.now.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}

function rank(s: ApplicabilityStatus): number {
  return { 'Not Applicable': 0, Optional: 1, 'Conditional Active': 2, Mandatory: 3 }[s]
}
function deltaBadge(was: ApplicabilityStatus, now: ApplicabilityStatus) {
  if (now === 'Not Applicable') return <span className="pill na">now N/A</span>
  if (was === 'Not Applicable') return <span className="pill conditional">newly in scope</span>
  return rank(now) > rank(was) ? <span className="pill mandatory">upgraded ▲</span> : <span className="pill optional">relaxed ▼</span>
}
