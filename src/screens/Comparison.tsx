import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList, Tooltip } from 'recharts'
import { useStore } from '../state/store'
import { Card, LabelPill, SUPPLIER_COLORS } from '../components/ui'
import type { FactorValidation, SupplierResult } from '../engine/types'

const DF_COLORS = ['#2f6d8f', '#7a8b3f', '#b8860b', '#a5673b', '#6a7f8c', '#8a5a6a', '#4a7c59']

function strengths(s: SupplierResult): FactorValidation[] {
  return s.factors.filter((f) => f.status === 'Pass').slice(0, 3)
}
function gaps(s: SupplierResult): FactorValidation[] {
  const order = ['Critical Flag', 'Missing', 'Below Threshold', 'Invalid', 'Watch']
  return [...s.factors].filter((f) => order.includes(f.status))
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status)).slice(0, 3)
}
function nextActions(s: SupplierResult): string[] {
  const actions: string[] = []
  if (s.criticalFlags.length) actions.push(`Resolve critical flag: ${s.criticalFlags.map((f) => f.name).join(', ')} before any sourcing commitment.`)
  const missing = s.factors.filter((f) => f.status === 'Missing')
  if (missing.length) actions.push(`Request missing evidence: ${missing.slice(0, 3).map((f) => f.name).join(', ')}.`)
  const below = s.factors.filter((f) => f.status === 'Below Threshold')
  if (below.length) actions.push(`Improvement plan for ${below.slice(0, 3).map((f) => f.name).join(', ')}.`)
  if (!actions.length) actions.push('Maintain evidence currency; suitable for the best-fit shortlist.')
  return actions
}

export default function Comparison() {
  const { result } = useStore()
  const ranked = [...result.suppliers].sort((a, b) => a.topsisRank - b.topsisRank)
  const chartData = ranked.map((s) => ({ id: s.id, name: s.name, readiness: Number((s.readiness * 100).toFixed(1)), color: SUPPLIER_COLORS[s.id] }))
  const bestFit = ranked.find((s) => s.criticalFlags.length === 0) ?? ranked[0]

  return (
    <div className="col gap16">
      <Card>
        <div className="card-head"><div className="card-title">Comparative supplier readiness</div><div className="card-hint">readiness % — ordered by relative TOPSIS rank</div></div>
        <div className="card-pad" style={{ height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 40 }}>
              <XAxis type="number" domain={[0, 100]} tick={{ fill: '#8b93a0', fontSize: 11 }} unit="%" />
              <YAxis type="category" dataKey="id" tick={{ fill: '#2a3644', fontSize: 12, fontWeight: 600 }} width={54} />
              <Tooltip formatter={(v) => `${v}%`} labelFormatter={(l) => chartData.find((c) => c.id === l)?.name ?? l} />
              <Bar dataKey="readiness" radius={[0, 5, 5, 0]} barSize={26}>
                {chartData.map((c) => <Cell key={c.id} fill={c.color} />)}
                <LabelList dataKey="readiness" position="right" formatter={(v: number) => `${v}%`} style={{ fontSize: 12, fill: '#14202e', fontWeight: 600 }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {ranked.map((s) => {
          const isBest = s.id === bestFit.id
          return (
            <Card key={s.id} className="">
              <div className="card-pad" style={isBest ? { boxShadow: 'inset 0 0 0 2px var(--accent)', borderRadius: 'var(--radius)' } : {}}>
                <div className="between" style={{ marginBottom: 12 }}>
                  <div className="flex center gap12">
                    <span className={`rank-badge ${s.topsisRank === 1 ? 'rank-1' : ''}`}>{s.topsisRank}</span>
                    <div>
                      <div className="flex center gap8"><strong>{s.id}</strong> <span className="muted">{s.name}</span></div>
                      <div className="muted" style={{ fontSize: 11 }}>TOPSIS score {s.topsisScore.toFixed(3)}</div>
                    </div>
                  </div>
                  <div className="col" style={{ alignItems: 'flex-end', gap: 4 }}>
                    <span className="readiness-num" style={{ fontSize: 24 }}>{(s.readiness * 100).toFixed(1)}%</span>
                    <LabelPill label={s.label} />
                  </div>
                </div>
                {isBest && <div className="pill pass" style={{ marginBottom: 10 }}>Best-fit shortlist candidate</div>}

                <div className="dfbar" style={{ marginBottom: 6 }}>
                  {s.dfResults.map((d, i) => {
                    const v = d.score ?? 0
                    return <div key={d.df} style={{ flex: d.weight, background: DF_COLORS[i], opacity: 0.35 + v * 0.65 }} title={`${d.df} ${d.score === null ? 'NA' : (v * 100).toFixed(0) + '%'}`}>{d.df.replace('DF', '')}</div>
                  })}
                </div>
                <div className="muted" style={{ fontSize: 10.5, marginBottom: 12 }}>Segment width = DF weight · shade = DF score</div>

                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div className="section-label strength">Top strengths</div>
                    <ul className="list-plain">{strengths(s).map((f) => <li key={f.code}>{f.name}</li>)}{strengths(s).length === 0 && <li className="muted">—</li>}</ul>
                  </div>
                  <div>
                    <div className="section-label gap-item">Top gaps</div>
                    <ul className="list-plain">{gaps(s).map((f) => <li key={f.code}>{f.name} <span className="muted">({f.status})</span></li>)}{gaps(s).length === 0 && <li className="muted">None</li>}</ul>
                  </div>
                </div>
                <div className="divider" />
                <div className="section-label">Next actions</div>
                <ul className="list-plain">{nextActions(s).map((a, i) => <li key={i} className="muted">{a}</li>)}</ul>
              </div>
            </Card>
          )
        })}
      </div>
      <p className="muted" style={{ fontSize: 12 }}>This is a comparative readiness recommendation and best-fit shortlist to support review — not a final approval, rejection, or automated decision.</p>
    </div>
  )
}
