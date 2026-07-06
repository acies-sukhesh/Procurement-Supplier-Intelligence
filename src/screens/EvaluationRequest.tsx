import { useStore } from '../state/store'
import { getStrategy, getWeights, DF_CODES } from '../engine/evaluate'
import decisionFactors from '../data/decisionFactors.json'
import strategies from '../data/strategies.json'
import { Card } from '../components/ui'
import type { DFCode, RequestContext } from '../engine/types'

const SELECTS: Array<{ key: keyof RequestContext; label: string; options: string[] }> = [
  { key: 'industry', label: 'Industry', options: ['Automotive', 'Aerospace', 'Electronics', 'Industrial'] },
  { key: 'part_criticality', label: 'Part criticality', options: ['Safety Critical', 'High', 'Medium', 'Low'] },
  { key: 'process_type', label: 'Process type', options: ['CNC', 'Casting', 'Welding', 'Stamping', 'Assembly'] },
  { key: 'required_qms', label: 'Required QMS', options: ['IATF', 'AS9100', 'ISO 9001', 'ISO 13485', 'None'] },
]

const TOGGLES: Array<{ key: keyof RequestContext; label: string }> = [
  { key: 'production_intent', label: 'Production intent' },
  { key: 'special_process_required', label: 'Special process required' },
  { key: 'cross_border_sourcing', label: 'Cross-border sourcing' },
  { key: 'design_or_ip_shared', label: 'Design / IP shared' },
  { key: 'customer_esg_mandate', label: 'Customer ESG mandate' },
  { key: 'abac_mandated', label: 'ABAC mandated' },
  { key: 'contract_insurance_required', label: 'Contract insurance required' },
  { key: 'mandated_commodity_or_ethics_requirement', label: 'Mandated commodity / ethics' },
  { key: 'region_blocked_or_sanctioned', label: 'Region blocked / sanctioned' },
]

const STAT_TILES: Array<{ label: string; status: string; cls: string }> = [
  { label: 'Mandatory', status: 'Mandatory', cls: 'mandatory' },
  { label: 'Optional', status: 'Optional', cls: 'optional' },
  { label: 'Conditional', status: 'Conditional Active', cls: 'conditional' },
  { label: 'Not Applicable', status: 'Not Applicable', cls: 'na' },
]

export default function EvaluationRequest() {
  const { context, setContext, setWeight, result, reset } = useStore()
  const isCustom = context.sourcing_strategy === 'Custom'
  const strategy = getStrategy(context)
  const weights = getWeights(context, strategy)
  const customSum = DF_CODES.reduce((s, df) => s + (context.customWeights?.[df] ?? 0), 0)

  const counts = result.applicability.reduce<Record<string, number>>((m, a) => {
    m[a.status] = (m[a.status] ?? 0) + 1
    return m
  }, {})

  return (
    <div className="col gap16">
      {/* ---- Slim applicability stat strip: 4 numbers only ---- */}
      <Card className="card-pad">
        <div className="statstrip">
          {STAT_TILES.map((t) => (
            <div className="statstrip-item" key={t.status}>
              <span className={`statstrip-dot ${t.cls}`} />
              <span className="statstrip-num">{counts[t.status] ?? 0}</span>
              <span className="statstrip-label">{t.label}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* ---- Form ---- */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', alignItems: 'start' }}>
        <Card>
          <div className="card-head"><div className="card-title">Part requirement</div></div>
          <div className="card-pad">
            <div className="form-grid">
              {SELECTS.map((s) => (
                <div className="field" key={s.key}>
                  <label>{s.label}</label>
                  <select value={String(context[s.key])} onChange={(e) => setContext({ [s.key]: e.target.value } as Partial<RequestContext>)}>
                    {s.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
              <div className="field">
                <label>Monthly demand (units/mo)</label>
                <input type="number" value={context.monthly_demand} min={0} step={500}
                  onChange={(e) => setContext({ monthly_demand: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>Evaluation date</label>
                <input type="date" value={context.eval_date} onChange={(e) => setContext({ eval_date: e.target.value })} />
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="card-head"><div className="card-title">Sourcing context</div><div className="card-hint">Yes / No toggles</div></div>
          <div className="card-pad">
            {TOGGLES.map((t) => (
              <div className="toggle-row" key={t.key}>
                <span>{t.label}</span>
                <span className="toggle">
                  {['Yes', 'No'].map((v) => (
                    <button key={v} className={context[t.key] === v ? 'active' : ''}
                      onClick={() => setContext({ [t.key]: v } as Partial<RequestContext>)}>{v}</button>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="card-head"><div className="card-title">Sourcing strategy</div>
          <button className="chip-btn" onClick={reset}>Reset to reference</button>
        </div>
        <div className="card-pad">
          <div className="segmented">
            {[...strategies, { id: 'Custom', name: 'Custom' }].map((s) => (
              <button key={s.id} className={context.sourcing_strategy === s.id ? 'active' : ''}
                onClick={() => setContext({ sourcing_strategy: s.id })}>{s.name}</button>
            ))}
          </div>

          <div className="divider" />

          <div className="between" style={{ marginBottom: 8 }}>
            <span className="section-label" style={{ margin: 0 }}>Decision factor weights</span>
            {isCustom && <span className={`sum-badge ${customSum === 100 ? 'ok' : 'bad'}`}>Σ {customSum} / 100</span>}
          </div>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', columnGap: 28 }}>
            {DF_CODES.map((df) => {
              const meta = decisionFactors.find((d) => d.code === df)!
              const val = weights[df]
              return (
                <div key={df}>
                  <div className="weight-bar" title={meta.name}>
                    <span className="mono muted" style={{ fontSize: 12 }}>{df}</span>
                    <div className="weight-track"><div className="weight-fill" style={{ width: `${val * 2.5}%` }} /></div>
                    <span className="weight-val">{val}</span>
                  </div>
                  {isCustom && (
                    <input type="range" min={0} max={40} value={context.customWeights?.[df] ?? 0}
                      onChange={(e) => setWeight(df as DFCode, Number(e.target.value))}
                      style={{ marginBottom: 6 }} aria-label={`${meta.name} weight`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </Card>
    </div>
  )
}
