import { useMemo, useState } from 'react'
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Legend, Tooltip } from 'recharts'
import { useStore } from '../state/store'
import { DF_CODES } from '../engine/evaluate'
import { buildSupplierProjection } from '../engine/projection'
import decisionFactors from '../data/decisionFactors.json'
import { Card, LabelPill, SUPPLIER_COLORS } from '../components/ui'

export default function Aggregation() {
  const { result, context, pushedClaims } = useStore()
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
  const projection = useMemo(
    () => buildSupplierProjection(context, pushedClaims, supplier),
    [context, pushedClaims, supplier],
  )

  const pct = (n: number) => (n * 100).toFixed(1) + '%'
  const signed = (n: number) => (n >= 0 ? '+' : '') + (n * 100).toFixed(1)

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

      <Card>
        <div className="card-head">
          <div className="card-title">{supplier.id} · What-if: closing evidence gaps</div>
          <span className="muted" style={{ fontSize: 12 }}>Hypothetical — does not change {supplier.id}'s actual score</span>
        </div>
        <div className="card-pad col gap16">
          {/* ---- Section A: score impact of applicable factors with no data ---- */}
          <div>
            <div className="section-label" style={{ marginTop: 0 }}>Score impact if provided</div>
            {projection.missing.length === 0 ? (
              <p className="muted" style={{ fontSize: 13, margin: 0 }}>
                No applicable (Mandatory / Conditional-Active) factors are missing evidence for {supplier.id}. Every in-scope
                factor already has data and is scored.
              </p>
            ) : (
              <>
                <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
                  These applicable factors currently have no evidence, so they score 0 today and are already dragging readiness
                  down. Providing evidence that passes would lift readiness cumulatively:
                </p>
                <div className="table-wrap">
                  <table className="data">
                    <thead>
                      <tr><th>Step</th><th>Factor</th><th>Decision factor</th><th>Δ readiness</th><th>Cumulative readiness</th></tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="muted">Now</td>
                        <td className="muted" style={{ fontSize: 12.5 }}>Current score (unchanged)</td>
                        <td className="muted">—</td>
                        <td className="mono muted">—</td>
                        <td className="mono"><strong>{pct(projection.readinessNow)}</strong></td>
                      </tr>
                      {projection.missing.map((m, i) => (
                        <tr key={m.code}>
                          <td className="mono muted">{i + 1}</td>
                          <td><strong style={{ fontWeight: 600 }}>{m.name}</strong> <span className="muted mono" style={{ fontSize: 11 }}>{m.code}</span></td>
                          <td className="muted" style={{ fontSize: 12.5 }}>{m.df} · {m.applicability}</td>
                          <td className="mono" style={{ color: 'var(--pass)' }}>{signed(m.delta)}</td>
                          <td className="mono">{pct(m.readinessAfter)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ fontWeight: 600 }}>
                        <td colSpan={4}>All {projection.missing.length} provided</td>
                        <td className="readiness-num" style={{ fontSize: 16 }}>{pct(projection.readinessAfterAllMissing)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* ---- Section B: critical items (label override) ---- */}
          {projection.critical.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
              <div className="section-label" style={{ marginTop: 0 }}>
                <span className="pill below" style={{ marginRight: 8 }}>Critical items</span>
              </div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>
                These factors fire a Critical Flag that overrides {supplier.id}'s label to
                <LabelPill label={projection.labelNow} /> regardless of score. Resolving them removes the label override in
                addition to the score change below — this is separate from the score-only impact above.
              </p>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr><th>Factor</th><th>Decision factor</th><th>Readiness</th><th>Label if resolved</th></tr>
                  </thead>
                  <tbody>
                    {projection.critical.map((c) => (
                      <tr key={c.code}>
                        <td><strong style={{ fontWeight: 600 }}>{c.name}</strong> <span className="muted mono" style={{ fontSize: 11 }}>{c.code}</span></td>
                        <td className="muted" style={{ fontSize: 12.5 }}>{c.df}</td>
                        <td className="mono">{pct(projection.readinessNow)} → {pct(c.readinessAfter)} <span style={{ color: 'var(--pass)' }}>({signed(c.delta)})</span></td>
                        <td>
                          <span className="flex center gap8">
                            <LabelPill label={projection.labelNow} /> →
                            {c.clearsOverrideAlone
                              ? <LabelPill label={c.labelAfter} />
                              : <span className="muted" style={{ fontSize: 12 }}>override remains (other critical items)</span>}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {projection.critical.length > 1 && (
                    <tfoot>
                      <tr style={{ fontWeight: 600 }}>
                        <td colSpan={2}>Resolve all {projection.critical.length} critical items</td>
                        <td className="mono">{pct(projection.readinessAfterAllCritical)}</td>
                        <td><LabelPill label={projection.labelAfterAllCritical} /></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}
