import { useMemo, useState } from 'react'
import { useStore, FOLLOWUP_LIMIT } from '../state/store'
import { Card, Icon, SUPPLIER_COLORS } from '../components/ui'
import { buildGapRegister, gapPillClass, whyItMatters, expectedEvidenceExamples, SIM_NOTE, type GapRow } from '../engine/evidence'
import type { RequestContext } from '../engine/types'
import suppliers from '../data/suppliers.json'

// Builds a real mailto: draft (never auto-sent) listing a supplier's missing items,
// reusing the same "why it matters" / "expected evidence" text as the Checklist.
function buildFollowUpMailto(to: string, supplierName: string, ctx: RequestContext, rows: GapRow[]): string {
  const n = rows.length
  const subject = `Evidence Request Follow-up — ${ctx.part_criticality} ${ctx.industry} part evaluation — ${n} item${n === 1 ? '' : 's'} outstanding`
  const items = rows
    .map((r, i) => `${i + 1}. ${r.name}\n   Why it matters: ${whyItMatters(r.field)}\n   Expected evidence: ${expectedEvidenceExamples(r.field).join(' / ')}`)
    .join('\n\n')
  const body = `Dear ${supplierName} team,\n\nAs part of our ${ctx.part_criticality} ${ctx.industry} sourcing evaluation, the following evidence items are still outstanding:\n\n${items}\n\nPlease provide the above documentation at your earliest convenience so we can complete the assessment.\n\nRegards,\nProcurement Team`
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

// Focused lens: only Weak + Missing evidence items across all suppliers,
// sorted by factor criticality (Mandatory first). Rendered collapsibly at the
// top of the Validation screen so it sits just before the threshold check.
export function GapRegisterSection() {
  const { result, followUps, recordFollowUp } = useStore()
  const rows = useMemo(() => buildGapRegister(result), [result])
  const [open, setOpen] = useState(true)

  const missing = rows.filter((r) => r.gapState === 'Missing').length
  const weak = rows.length - missing

  // Missing items grouped per supplier (drives the one-supplier-at-a-time follow-up action).
  const missingBySupplier = useMemo(() => {
    const m: Record<string, GapRow[]> = {}
    rows.forEach((r) => { if (r.gapState === 'Missing') (m[r.supplierId] ??= []).push(r) })
    return m
  }, [rows])
  const ctx = result.context

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

          {Object.keys(missingBySupplier).length > 0 && (
            <div className="card-pad" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="section-label">Request follow-up on missing evidence</div>
              <div className="col">
                {Object.entries(missingBySupplier).map(([sid, mrows]) => {
                  const sup = suppliers.find((s) => s.id === sid)
                  const fu = followUps[sid]
                  const count = fu?.count ?? 0
                  const reached = count >= FOLLOWUP_LIMIT
                  return (
                    <div key={sid} className="between wrap" style={{ gap: 12, padding: '10px 0', borderBottom: '1px dashed var(--border)' }}>
                      <div className="flex center gap8 wrap">
                        <span style={{ width: 9, height: 9, borderRadius: 3, background: SUPPLIER_COLORS[sid], display: 'inline-block' }} />
                        <strong style={{ fontWeight: 600 }}>{sid}</strong>
                        <span className="muted" style={{ fontSize: 12 }}>{mrows.length} missing item{mrows.length === 1 ? '' : 's'}</span>
                        {count > 0 && (
                          <span className="muted" style={{ fontSize: 11 }}>
                            · requested {count}× · last {new Date(fu!.lastAt).toLocaleString()}
                          </span>
                        )}
                      </div>
                      {reached ? (
                        <span className="pill watch">Follow-up limit reached — this supplier will be scored and labeled as-is.</span>
                      ) : sup?.contact_email ? (
                        <a
                          className="bulk-btn"
                          style={{ textDecoration: 'none' }}
                          href={buildFollowUpMailto(sup.contact_email, sup.name, ctx, mrows)}
                          onClick={() => recordFollowUp(sid)}
                        >
                          <Icon name="flag" size={13} /> Draft follow-up email for {sid} ({mrows.length})
                        </a>
                      ) : null}
                    </div>
                  )
                })}
              </div>
              <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>
                Opens a pre-filled draft in your email client — nothing is sent automatically.
              </p>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
