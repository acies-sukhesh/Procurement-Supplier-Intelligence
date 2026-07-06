import { useState } from 'react'
import { useStore } from '../state/store'
import leafFactors from '../data/leafFactors.json'
import decisionFactors from '../data/decisionFactors.json'
import suppliers from '../data/suppliers.json'
import { Card, Icon, Kpi, SUPPLIER_COLORS } from '../components/ui'
import type { ApplicabilityStatus, DFCode } from '../engine/types'
import { evidenceMeta, gapPillClass, SIM_NOTE, type EvidenceMeta, type GapState } from '../engine/evidence'
import { SimBanner } from './EvidenceChecklist'

interface Selected {
  supplierId: string
  supplierName: string
  factorName: string
  code: string
  field: string
  displayValue: string
  meta: EvidenceMeta
}

const GAP_HINT: Record<string, string> = {
  Covered: 'Evidence present with strong simulated confidence.',
  Weak: 'Evidence present but with restricted / deferred simulated attribution.',
  Missing: 'No value submitted for this applicable factor.',
  Null: 'Factor is Not Applicable under the current request — out of scope.',
}

export default function SupplierData() {
  const { result } = useStore()
  const [hideNA, setHideNA] = useState(false)
  const [selected, setSelected] = useState<Selected | null>(null)
  const appByField = new Map(result.applicability.map((a) => [a.field, a.status]))

  // Gap-state summary across every supplier x factor cell (same simulated metadata the cells show).
  const gapCounts: Record<GapState, number> = { Covered: 0, Weak: 0, Missing: 0, Null: 0 }
  for (const lf of leafFactors) {
    const app = (appByField.get(lf.canonicalField) ?? 'Optional') as ApplicabilityStatus
    for (const s of suppliers) {
      const v = (s.values as Record<string, unknown>)[lf.canonicalField]
      gapCounts[evidenceMeta(lf.canonicalField, s.id, v, app, lf.df as DFCode).gapState] += 1
    }
  }

  return (
    <div className="col gap16">
      <SimBanner />

      <div className="kpi-row">
        <Kpi num={gapCounts.Covered} label="Covered" accent />
        <Kpi num={gapCounts.Weak} label="Weak" />
        <Kpi num={gapCounts.Missing} label="Missing" />
        <Kpi num={gapCounts.Null} label="Null (Not Applicable)" />
      </div>

      <Card className="card-pad">
        <div className="between wrap gap12">
          <div className="flex gap16 wrap">
            {suppliers.map((s) => (
              <span key={s.id} className="flex center gap8" style={{ fontSize: 13 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: SUPPLIER_COLORS[s.id], display: 'inline-block' }} />
                <strong>{s.id}</strong> <span className="muted">{s.name}</span>
              </span>
            ))}
          </div>
          <label className="flex center gap8" style={{ fontSize: 12.5 }}>
            <input type="checkbox" checked={hideNA} onChange={(e) => setHideNA(e.target.checked)} /> Hide Not-Applicable rows
          </label>
        </div>
        <div className="divider" />
        <div className="flex gap16 wrap" style={{ fontSize: 11.5 }}>
          <span className="muted">Cell tag = gap state:</span>
          <span className="flex center gap8"><span className="pill pass">Covered</span> conf ≥ 0.70</span>
          <span className="flex center gap8"><span className="pill watch">Weak</span> 0.40–0.69</span>
          <span className="flex center gap8"><span className="pill below">Missing</span> no value</span>
          <span className="flex center gap8"><span className="pill na">Null</span> Not Applicable</span>
          <span className="muted">· click any cell for the simulated evidence detail</span>
        </div>
      </Card>

      {decisionFactors.map((df) => {
        const rows = leafFactors
          .filter((lf) => lf.df === (df.code as DFCode))
          .filter((lf) => !hideNA || appByField.get(lf.canonicalField) !== 'Not Applicable')
        if (rows.length === 0) return null
        return (
          <Card key={df.code}>
            <div className="card-head"><div className="card-title">{df.code} · {df.name}</div><div className="card-hint">{rows.length} factors</div></div>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th style={{ minWidth: 210 }}>Leaf factor</th>
                    {suppliers.map((s) => <th key={s.id}>{s.id}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((lf) => {
                    const app = (appByField.get(lf.canonicalField) ?? 'Optional') as ApplicabilityStatus
                    const na = app === 'Not Applicable'
                    return (
                      <tr key={lf.code} className={na ? 'na-row' : ''}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{lf.name}</div>
                          <div className="mono muted" style={{ fontSize: 11 }}>{lf.canonicalField}{na ? ' · Not Applicable' : ''}</div>
                        </td>
                        {suppliers.map((s) => {
                          const v = (s.values as Record<string, unknown>)[lf.canonicalField]
                          const disp = v === '' || v === null || v === undefined ? '—' : String(v)
                          const meta = evidenceMeta(lf.canonicalField, s.id, v, app, df.code as DFCode)
                          return (
                            <td
                              key={s.id}
                              className="row-clickable"
                              onClick={() =>
                                setSelected({
                                  supplierId: s.id,
                                  supplierName: s.name,
                                  factorName: lf.name,
                                  code: lf.code,
                                  field: lf.canonicalField,
                                  displayValue: disp,
                                  meta,
                                })
                              }
                            >
                              <div className="mono" style={{ fontWeight: 600 }}>{disp}</div>
                              <span className={`pill ${gapPillClass(meta.gapState)}`} style={{ fontSize: 10, padding: '1px 7px', marginTop: 3 }}>
                                {meta.gapState}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}

      {selected && <EvidenceDrawer sel={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function EvidenceDrawer({ sel, onClose }: { sel: Selected; onClose: () => void }) {
  const { meta } = sel
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head between">
          <div>
            <div className="muted mono" style={{ fontSize: 12 }}>{sel.code} · {sel.supplierId}</div>
            <h3 style={{ fontSize: 18, marginTop: 4 }}>{sel.factorName}</h3>
            <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>{sel.field}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="drawer-body">
          <div className="between" style={{ marginBottom: 16 }}>
            <span className="muted">{sel.supplierName}</span>
            <span className={`pill ${gapPillClass(meta.gapState)}`}>{meta.gapState}</span>
          </div>

          <div className="section-label">Submitted value</div>
          <div className="mono" style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>{sel.displayValue}</div>

          <div className="section-label">Simulated evidence assessment</div>
          <div className="col gap8" style={{ fontSize: 13 }}>
            <div className="between"><span className="muted">Claim type</span><strong>{meta.claimType}</strong></div>
            <div className="between">
              <span className="muted">Confidence</span>
              <strong>{meta.confidence === null ? '—' : meta.confidence.toFixed(2)}</strong>
            </div>
            <div className="between"><span className="muted">Source type</span><strong>{meta.sourceType}</strong></div>
            <div className="between"><span className="muted">Sourcing state</span><strong>{meta.dataState}</strong></div>
            <div className="between"><span className="muted">Source reference</span><strong>{meta.sourceRef}</strong></div>
            <div className="between"><span className="muted">Gap state</span><strong>{meta.gapState}</strong></div>
          </div>

          <div className="divider" />
          <p className="muted" style={{ fontSize: 12 }}>{GAP_HINT[meta.gapState]}</p>
          <p className="muted" style={{ fontSize: 12 }}>
            Confidence and source are illustrative for this prototype. {SIM_NOTE} The Pass/Watch/Below threshold check on
            the Validation screen runs on the same underlying value, unchanged.
          </p>
        </div>
      </aside>
    </>
  )
}
