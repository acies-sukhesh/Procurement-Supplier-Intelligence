import { Fragment, useMemo, useState } from 'react'
import leafFactors from '../data/leafFactors.json'
import metrics from '../data/metrics.json'
import decisionFactors from '../data/decisionFactors.json'
import { Card, Icon } from '../components/ui'

interface MetricDef {
  type: string; unit: string; direction: string
  pass?: number; watch?: number; relativeTo?: string
  passSet?: string[]; watchSet?: string[]; failSet?: string[]
  bufferDays?: number; criticalFlagRule?: string; evidence: string; provisional: boolean
}
const defs = metrics as unknown as Record<string, MetricDef>

function thresholdText(d: MetricDef): string {
  if (d.type === 'date') return `Valid ≥ ${d.bufferDays ?? 30}-day buffer → Pass; within buffer → Watch; expired → Below / Critical`
  if (d.type === 'enum') return `Pass: ${d.passSet?.join(', ')} · Watch: ${d.watchSet?.join(', ') || '—'} · Below: ${d.failSet?.join(', ') || '—'}`
  const rel = d.relativeTo ? ` × ${d.relativeTo.replace(/_/g, ' ')}` : ''
  if (d.direction === 'gte') return `Pass ≥ ${d.pass}${rel} · Watch ≥ ${d.watch}${rel} · else Below`
  return `Pass ≤ ${d.pass}${rel} · Watch ≤ ${d.watch}${rel} · else Below`
}

export default function MetricDictionary() {
  const [q, setQ] = useState('')
  const [dfFilter, setDfFilter] = useState<string>('all')
  const [expanded, setExpanded] = useState<string | null>(null)

  const rows = useMemo(() => leafFactors.filter((lf) => {
    if (dfFilter !== 'all' && lf.df !== dfFilter) return false
    const hay = `${lf.code} ${lf.name} ${lf.canonicalField}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  }), [q, dfFilter])

  return (
    <Card>
      <div className="card-head">
        <div className="flex center gap8" style={{ flex: 1 }}>
          <Icon name="search" size={16} />
          <input className="searchbox" placeholder="Search field, factor, or code…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex gap8 wrap">
          <button className={`chip-btn ${dfFilter === 'all' ? 'active' : ''}`} onClick={() => setDfFilter('all')}>All</button>
          {decisionFactors.map((d) => (
            <button key={d.code} className={`chip-btn ${dfFilter === d.code ? 'active' : ''}`} onClick={() => setDfFilter(d.code)}>{d.code}</button>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Code</th><th>Canonical field</th><th>Type</th><th>Unit</th><th>Direction</th><th>Threshold</th><th></th></tr></thead>
          <tbody>
            {rows.map((lf) => {
              const d = defs[lf.canonicalField]
              const isOpen = expanded === lf.code
              return (
                <Fragment key={lf.code}>
                  <tr className="row-clickable" onClick={() => setExpanded(isOpen ? null : lf.code)}>
                    <td className="mono muted">{lf.code}</td>
                    <td><span className="mono" style={{ fontWeight: 600 }}>{lf.canonicalField}</span><div className="muted" style={{ fontSize: 11 }}>{lf.name}</div></td>
                    <td><span className="tag">{d.type}</span></td>
                    <td className="muted">{d.unit}</td>
                    <td className="muted">{d.direction === 'gte' ? 'higher better' : d.direction === 'lte' ? 'lower better' : d.direction}</td>
                    <td style={{ fontSize: 12 }}>{thresholdText(d)}</td>
                    <td><span className={`caret ${isOpen ? 'open' : ''}`}><Icon name="chevron" size={14} /></span></td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={7} style={{ background: '#fbfbf9' }}>
                        <div className="flex gap16 wrap" style={{ padding: '6px 4px' }}>
                          <Field label="Decision factor">{lf.df} · {decisionFactors.find((x) => x.code === lf.df)!.name}</Field>
                          <Field label="Evidence required">{d.evidence}</Field>
                          <Field label="Critical-flag rule">{d.criticalFlagRule ? d.criticalFlagRule : 'none'}</Field>
                          <Field label="Threshold basis">{d.provisional ? 'Provisional — pending review' : 'Representative band (spec §4)'}</Field>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ minWidth: 180 }}>
      <div className="section-label" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13 }}>{children}</div>
    </div>
  )
}
