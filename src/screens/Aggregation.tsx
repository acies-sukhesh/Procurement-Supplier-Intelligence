import { useState } from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useStore } from '../state/store'
import { DF_CODES } from '../engine/evaluate'
import decisionFactors from '../data/decisionFactors.json'
import { Card, LabelPill, SUPPLIER_COLORS } from '../components/ui'

export default function Aggregation() {
  const { result } = useStore()
  const [active, setActive] = useState<string>(result.suppliers[0].id)
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(result.suppliers.map((s) => [s.id, true])))

  const radarData = DF_CODES.map((df) => {
    const meta = decisionFactors.find((d) => d.code === df)!
    const row: Record<string, number | string> = { df: meta.short }
    result.suppliers.forEach((s) => {
      const d = s.dfResults.find((x) => x.df === df)!
      row[s.id] = d.score === null ? 0 : Number((d.score * 100).toFixed(1))
    })
    return row
  })

  const supplier = result.suppliers.find((s) => s.id === active)!

  return (
    <div className="col gap16">
      <div className="grid" style={{ gridTemplateColumns: '1.2fr 1fr', alignItems: 'stretch' }}>
        <Card>
          <div className="card-head"><div className="card-title">Decision-factor readiness profile</div><div className="card-hint">score % per decision factor</div></div>
          <div className="card-pad" style={{ height: 420 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="#e2e1da" />
                <PolarAngleAxis dataKey="df" tick={{ fill: '#4a5a6a', fontSize: 12 }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: '#8b93a0', fontSize: 10 }} />
                {result.suppliers.filter((s) => visible[s.id]).map((s) => (
                  <Radar key={s.id} name={s.id} dataKey={s.id} stroke={SUPPLIER_COLORS[s.id]} fill={SUPPLIER_COLORS[s.id]} fillOpacity={0.08} strokeWidth={2} />
                ))}
                <Tooltip />
                <Legend onClick={(e) => setVisible((v) => ({ ...v, [String(e.value)]: !v[String(e.value)] }))} />
              </RadarChart>
            </ResponsiveContainer>
            <div className="muted" style={{ fontSize: 11, textAlign: 'center' }}>Click a legend entry to toggle a supplier.</div>
          </div>
        </Card>

        <Card>
          <div className="card-head"><div className="card-title">Readiness summary</div></div>
          <div className="card-pad col gap8">
            {result.suppliers.map((s) => (
              <div key={s.id} className="between row-clickable" onClick={() => setActive(s.id)}
                style={{ padding: '8px 10px', borderRadius: 8, background: s.id === active ? 'var(--accent-soft)' : 'transparent' }}>
                <div className="flex center gap8">
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: SUPPLIER_COLORS[s.id] }} />
                  <strong>{s.id}</strong> <span className="muted" style={{ fontSize: 12 }}>{s.name}</span>
                </div>
                <div className="flex center gap12">
                  <span className="readiness-num" style={{ fontSize: 18 }}>{(s.readiness * 100).toFixed(1)}%</span>
                  <LabelPill label={s.label} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="card-head">
          <div className="card-title">{supplier.id} · {supplier.name} — metric → decision factor → readiness roll-up</div>
          {supplier.gateCapped && <span className="pill below">Mandatory-floor gate fired — label capped at Needs Review</span>}
        </div>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Decision factor</th><th>Weight</th><th>Scored factors (denominator)</th><th>DF score</th><th>Weighted contribution</th><th>Gate</th></tr></thead>
            <tbody>
              {supplier.dfResults.map((d) => (
                <tr key={d.df}>
                  <td><strong style={{ fontWeight: 600 }}>{d.df}</strong> · {d.name}</td>
                  <td className="mono">{d.weight}</td>
                  <td className="mono">{d.scoredCount}</td>
                  <td className="mono">{d.score === null ? '—' : (d.score * 100).toFixed(1) + '%'}</td>
                  <td className="mono">{d.score === null ? '—' : (d.score * d.weight).toFixed(1)}</td>
                  <td>{d.hasMandatory ? (d.belowFloor ? <span className="pill below">below floor</span> : <span className="pill pass">ok</span>) : <span className="muted" style={{ fontSize: 12 }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background: '#fbfbf9', fontWeight: 600 }}>
                <td>Readiness = Σ(DF score × weight) / Σ(weight of scored DFs)</td>
                <td className="mono">{supplier.dfResults.filter((d) => d.score !== null).reduce((a, d) => a + d.weight, 0)}</td>
                <td colSpan={2} className="mono">{supplier.dfResults.filter((d) => d.score !== null).reduce((a, d) => a + (d.score ?? 0) * d.weight, 0).toFixed(1)} / weight</td>
                <td className="readiness-num" style={{ fontSize: 17 }}>{(supplier.readiness * 100).toFixed(1)}%</td>
                <td><LabelPill label={supplier.label} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  )
}
