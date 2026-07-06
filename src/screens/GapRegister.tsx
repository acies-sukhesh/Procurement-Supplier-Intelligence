import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { Card, Icon, SUPPLIER_COLORS } from '../components/ui'
import { buildGapRegister, gapPillClass, SIM_NOTE } from '../engine/evidence'

// Focused lens: only Weak + Missing evidence items across all suppliers,
// sorted by factor criticality (Mandatory first). Rendered collapsibly at the
// top of the Validation screen so it sits just before the threshold check.
export function GapRegisterSection() {
  const { result } = useStore()
  const rows = useMemo(() => buildGapRegister(result), [result])
  const [open, setOpen] = useState(true)

  const missing = rows.filter((r) => r.gapState === 'Missing').length
  const weak = rows.length - missing

  return (
    <Card id="gap-register">
      <div className="collapse-head" onClick={() => setOpen((o) => !o)}>
        <span className={`caret ${open ? 'open' : ''}`}><Icon name="chevron" size={15} /></span>
        <strong style={{ fontFamily: 'var(--serif)' }}>Gap Register</strong>
        <span className="muted" style={{ fontSize: 12 }}>evidence gaps before the threshold check</span>
        <span style={{ flex: 1 }} />
        {missing > 0 && <span className="pill below">{missing} missing</span>}
        {weak > 0 && <span className="pill watch">{weak} weak</span>}
        {rows.length === 0 && <span className="pill pass">no gaps</span>}
      </div>
      {open && (
        <>
          <div style={{ padding: '12px 20px 0' }}>
            <p className="muted" style={{ fontSize: 12 }}>
              Simulated — {SIM_NOTE}
            </p>
          </div>
          {rows.length === 0 ? (
            <div className="card-pad muted">No Weak or Missing evidence items under the current request.</div>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Supplier</th>
                    <th>Code</th>
                    <th>Factor</th>
                    <th>Applicability</th>
                    <th>Gap</th>
                    <th>Confidence</th>
                    <th>Recommended action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={`${r.supplierId}-${r.code}-${i}`}>
                      <td>
                        <span className="flex center gap8">
                          <span style={{ width: 9, height: 9, borderRadius: 3, background: SUPPLIER_COLORS[r.supplierId], display: 'inline-block' }} />
                          <strong style={{ fontWeight: 600 }}>{r.supplierId}</strong>
                        </span>
                      </td>
                      <td className="mono muted">{r.code}</td>
                      <td><strong style={{ fontWeight: 600 }}>{r.name}</strong></td>
                      <td className="muted" style={{ fontSize: 12 }}>{r.applicability}</td>
                      <td><span className={`pill ${gapPillClass(r.gapState)}`}>{r.gapState}</span></td>
                      <td className="mono">{r.confidence === null ? '—' : r.confidence.toFixed(2)}</td>
                      <td className="muted" style={{ fontSize: 12.5 }}>{r.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
