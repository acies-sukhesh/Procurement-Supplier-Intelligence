import { useState } from 'react'
import { useStore } from '../state/store'
import { Card, StatusPill, SUPPLIER_COLORS } from '../components/ui'
import { GapRegisterSection } from './GapRegister'
import { evidenceMeta, gapPillClass } from '../engine/evidence'
import metrics from '../data/metrics.json'
import type { FactorValidation, RequestContext, SupplierResult, ValidationStatus } from '../engine/types'

const SEGMENTS: Array<{ status: ValidationStatus; cls: string; label: string }> = [
  { status: 'Pass', cls: 's-pass', label: 'Pass' },
  { status: 'Watch', cls: 's-watch', label: 'Watch' },
  { status: 'Below Threshold', cls: 's-below', label: 'Below' },
  { status: 'Missing', cls: 's-missing', label: 'Missing' },
  { status: 'Invalid', cls: 's-invalid', label: 'Invalid' },
  { status: 'Critical Flag', cls: 's-critical', label: 'Critical' },
]

const FILTERS: Array<ValidationStatus | 'all'> = ['all', 'Critical Flag', 'Below Threshold', 'Missing', 'Watch', 'Pass', 'Not Applicable']

export default function Validation() {
  const { result } = useStore()
  const [active, setActive] = useState<string>(result.suppliers[0].id)
  const [filter, setFilter] = useState<ValidationStatus | 'all'>('all')
  const supplier = result.suppliers.find((s) => s.id === active)!

  return (
    <div className="col gap16">
      <div className="info-banner">
        <strong>Evidence vs validation</strong>
        <span>
          Evidence status shows how well-documented a fact is. Validation status shows whether that fact meets the
          requirement. A well-documented fact can still fail the requirement — these are two separate checks.
        </span>
      </div>
      <GapRegisterSection />
      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))' }}>
        {result.suppliers.map((s) => (
          <SupplierCard key={s.id} s={s} active={s.id === active} onClick={() => setActive(s.id)} />
        ))}
      </div>

      <Card>
        <div className="card-head">
          <div className="card-title">{supplier.id} · {supplier.name} — factor detail</div>
          <div className="flex gap8 wrap">
            {FILTERS.map((f) => (
              <button key={f} className={`chip-btn ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Code</th><th>Factor</th><th>Applicability</th><th>Value</th><th>Status</th><th>Score</th><th>Note</th></tr></thead>
            <tbody>
              {supplier.factors.filter((f) => filter === 'all' || f.status === filter).map((f) => (
                <tr key={f.code} className={f.critical ? 'row-critical' : ''}>
                  <td className="mono muted">{f.code}</td>
                  <td><strong style={{ fontWeight: 600 }}>{f.name}</strong></td>
                  <td className="muted" style={{ fontSize: 12 }}>{f.applicability}</td>
                  <td className="mono">{f.displayValue}</td>
                  <td><CombinedStatus f={f} supplierId={active} ctx={result.context} /></td>
                  <td className="mono">{f.score === null ? '—' : f.score.toFixed(1)}</td>
                  <td className="muted" style={{ fontSize: 12 }}>{f.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

// Short "minimum requirement" hint derived from the metric bands (display only — the scoring
// engine remains the source of truth). Empty for Pass / Not Applicable.
function thresholdHint(f: FactorValidation, ctx: RequestContext): string {
  if (f.status === 'Pass' || f.status === 'Not Applicable') return ''
  const def = (metrics as unknown as Record<string, { type: string; direction?: string; watch?: number; passSet?: string[]; relativeTo?: string }>)[f.field]
  if (!def) return ''
  if (def.type === 'numeric' && def.watch !== undefined) {
    let watchT = def.watch
    if (def.relativeTo) {
      const basis = Number((ctx as unknown as Record<string, number>)[def.relativeTo]) || 0
      watchT = Math.round(def.watch * basis)
    }
    return `needs ${def.direction === 'gte' ? '≥' : '≤'} ${watchT}`
  }
  if (def.type === 'enum') return `needs ${(def.passSet ?? []).join(' / ')}`
  if (def.type === 'date') return 'needs a valid certificate'
  return ''
}

// Combined evidence + validation for a factor row: [evidence pill] → value → [validation pill].
// Factors with no Evidence Register entry (Not Applicable / gapState "Null") show validation alone.
function CombinedStatus({ f, supplierId, ctx }: { f: FactorValidation; supplierId: string; ctx: RequestContext }) {
  const meta = evidenceMeta(f.field, supplierId, f.value, f.applicability, f.df)
  if (meta.gapState === 'Null') return <StatusPill status={f.status} />
  const hint = thresholdHint(f, ctx)
  return (
    <span className="flex center gap8 wrap" style={{ fontSize: 12 }}>
      <span className={`pill ${gapPillClass(meta.gapState)}`}>{meta.gapState}</span>
      {meta.confidence !== null && (
        <span className="muted">({Math.round(meta.confidence * 100)}% confidence)</span>
      )}
      <span className="muted">→</span>
      <span className="mono">{f.displayValue}</span>
      <span className="muted">→</span>
      <StatusPill status={f.status} />
      {hint && <span className="muted">({hint})</span>}
    </span>
  )
}

function SupplierCard({ s, active, onClick }: { s: SupplierResult; active: boolean; onClick: () => void }) {
  const total = SEGMENTS.reduce((n, seg) => n + s.counts[seg.status], 0)
  return (
    <Card className={active ? '' : ''}>
      <div className="card-pad row-clickable" onClick={onClick} style={active ? { boxShadow: 'inset 0 0 0 2px var(--accent)', borderRadius: 'var(--radius)' } : {}}>
        <div className="between" style={{ marginBottom: 10 }}>
          <div className="flex center gap8">
            <span style={{ width: 10, height: 10, borderRadius: 3, background: SUPPLIER_COLORS[s.id] }} />
            <strong>{s.id}</strong>
          </div>
          {s.criticalFlags.length > 0 && <span className="pill critical">{s.criticalFlags.length} critical</span>}
        </div>
        <div className="muted" style={{ fontSize: 12, marginBottom: 10, minHeight: 32 }}>{s.name}</div>
        <div className="stack">
          {SEGMENTS.map((seg) => {
            const w = total ? (s.counts[seg.status] / total) * 100 : 0
            return w > 0 ? <span key={seg.status} className={seg.cls} style={{ width: `${w}%` }} title={`${seg.label}: ${s.counts[seg.status]}`} /> : null
          })}
        </div>
        <div className="stack-legend">
          {SEGMENTS.filter((seg) => s.counts[seg.status] > 0).map((seg) => (
            <span key={seg.status}><span className={`legend-dot`} style={{ background: `var(--${legendVar(seg.cls)})` }} />{seg.label} {s.counts[seg.status]}</span>
          ))}
        </div>
      </div>
    </Card>
  )
}

function legendVar(cls: string): string {
  switch (cls) {
    case 's-pass': return 'pass'
    case 's-watch': return 'watch'
    case 's-below': return 'below'
    case 's-critical': return 'critical'
    default: return 'na'
  }
}
