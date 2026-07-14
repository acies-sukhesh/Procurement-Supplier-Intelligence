import { useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { evaluate } from '../engine/evaluate'
import decisionFactors from '../data/decisionFactors.json'
import metrics from '../data/metrics.json'
import factorImpacts from '../data/factorImpacts.json'
import { ApplicabilityPill, Card, Icon, Kpi, LabelPill, SUPPLIER_COLORS } from '../components/ui'
import type { DFCode, FactorApplicability, FactorImpact } from '../engine/types'

const TOTAL_FACTORS = 43

const metricDefs = metrics as unknown as Record<string, { evidence?: string }>
const impactDefs = factorImpacts as unknown as Record<string, { riskBlindSpot?: string }>

// ─── Selection type label map ─────────────────────────────────────────────────
const SELECTION_LABELS: Record<string, { label: string; icon: string; cls: string }> = {
  'policy-required':    { label: 'Policy Required',     icon: '🔒', cls: 'mandatory' },
  'system-recommended': { label: 'System Recommended',  icon: '★',  cls: 'conditional' },
  'optional':           { label: 'Optional',             icon: '○',  cls: 'optional' },
  'not-applicable':     { label: 'Not Applicable',       icon: '—',  cls: 'na' },
}

// ─── Impact Analyzer computation ──────────────────────────────────────────────
// For each inactive (non-included) factor, simulate adding it and measure
// readiness change, confidence change, risk, and missing data source.
function computeFactorImpacts(
  result: ReturnType<typeof useStore>['result'],
  context: ReturnType<typeof useStore>['context'],
  pushedClaims: Record<string, Record<string, unknown>>,
  userSelections: Record<string, boolean>,
): FactorImpact[] {
  const app = result.applicability
  const inactive = app.filter((a) => !a.includedInEvaluation && a.selectionType !== 'not-applicable')

  return inactive.map((a) => {
    // Simulate adding this factor
    const simSelections = { ...userSelections, [a.code]: true }
    const simResult = evaluate(context, pushedClaims, simSelections)

    // Readiness delta per supplier
    const readinessDelta: Record<string, number> = {}
    result.suppliers.forEach((s) => {
      const simSupplier = simResult.suppliers.find((x) => x.id === s.id)!
      readinessDelta[s.id] = simSupplier.readiness - s.readiness
    })

    // Confidence delta: one more factor in evaluation
    const confidenceDelta = 1 / TOTAL_FACTORS

    // Risk blind spot from dedicated impact map
    const riskBlindSpot = impactDefs[a.code]?.riskBlindSpot ?? `Unmonitored risk: ${a.name}`

    // Missing data source from metrics.json evidence field
    const missingDataSource = metricDefs[a.field]?.evidence ?? 'Source document not specified'

    return {
      code: a.code,
      name: a.name,
      df: a.df,
      field: a.field,
      selectionType: a.selectionType,
      readinessDelta,
      confidenceDelta,
      riskBlindSpot,
      missingDataSource,
    }
  })
}

export default function RulesApplicability({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { result, context, pushedClaims, userSelections, setUserSelection, resetUserSelections, saveScenario } = useStore()
  const app = result.applicability
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(decisionFactors.map((d) => [d.code, true])))
  const [selected, setSelected] = useState<FactorApplicability | null>(null)
  const [showImpact, setShowImpact] = useState(false)
  const [scenarioName, setScenarioName] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  const activeCount = app.filter((a) => a.includedInEvaluation).length
  const applicableCount = app.filter((a) => a.selectionType !== 'not-applicable').length
  const inactiveNonNa = app.filter((a) => !a.includedInEvaluation && a.selectionType !== 'not-applicable').length

  // "No user selections" baseline — memoized on context only (NOT userSelections),
  // so it stays fixed while the user toggles factors. Drives the per-supplier delta.
  const baseline = useMemo(() => evaluate(context, {}, {}), [context])

  const handleSaveScenario = () => {
    if (!scenarioName.trim()) return
    saveScenario(scenarioName.trim())
    setScenarioName('')
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  // Impact analysis — only computed when expanded to avoid expensive simulations
  const impacts = useMemo(() => {
    if (!showImpact) return []
    return computeFactorImpacts(result, context, pushedClaims, userSelections)
  }, [showImpact, result, context, pushedClaims, userSelections])

  // Aggregate each factor's impact across all suppliers (sum of readiness change),
  // then rank by magnitude. Factor selection is global, so impact is portfolio-wide.
  const sortedImpacts = useMemo(() => {
    return impacts
      .map((imp) => ({ imp, total: Object.values(imp.readinessDelta).reduce((a, b) => a + b, 0) }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  }, [impacts])

  const count = (s: string) => app.filter((a) => a.status === s).length

  return (
    <div className="col gap16">
      {/* ──── KPI row ──── */}
      <div className="kpi-row">
        <Kpi num={app.filter((a) => a.selectionType === 'policy-required').length} label="Policy Required" />
        <Kpi num={app.filter((a) => a.selectionType === 'system-recommended').length} label="System Recommended" accent />
        <Kpi num={app.filter((a) => a.selectionType === 'optional').length} label="Optional" />
        <Kpi num={count('Not Applicable')} label="Not Applicable" />
        <Kpi num={activeCount} label="Active in Evaluation" />
      </div>

      {/* ──── Global selection summary (applies to every supplier equally) ──── */}
      <Card className="card-pad">
        <div className="between wrap" style={{ gap: 12 }}>
          <div style={{ maxWidth: 560 }}>
            <div className="section-label" style={{ margin: '0 0 6px' }}>Factor selection applies to all suppliers equally</div>
            <div className="muted" style={{ fontSize: 12.5 }}>
              Included factors are scored identically for every supplier. Policy-required factors are locked by the active
              rule template and cannot be skipped; system-recommended and optional factors are yours to include or skip.
            </div>
          </div>
          <div className="flex center gap16">
            <div style={{ textAlign: 'right' }}>
              <div className="muted" style={{ fontSize: 11 }}>Active in evaluation</div>
              <span className="readiness-num" style={{ fontSize: 18 }}>{activeCount} / {TOTAL_FACTORS}</span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="muted" style={{ fontSize: 11 }}>Evaluation confidence</div>
              <span className="readiness-num" style={{ fontSize: 18 }}>{((activeCount / TOTAL_FACTORS) * 100).toFixed(0)}%</span>
            </div>
          </div>
        </div>
        {inactiveNonNa > 0 && (
          <div className="between wrap" style={{ marginTop: 10, gap: 8 }}>
            <span className="pill watch">{inactiveNonNa} available factor{inactiveNonNa === 1 ? '' : 's'} not included in evaluation</span>
            <button className="chip-btn" onClick={resetUserSelections}>Reset to defaults</button>
          </div>
        )}
      </Card>

      {/* ──── Factor table per DF ──── */}
      {decisionFactors.map((df) => {
        const rows = app.filter((a) => a.df === (df.code as DFCode))
        const isOpen = open[df.code]
        const dfActive = rows.filter((r) => r.includedInEvaluation).length
        return (
          <Card key={df.code}>
            <div className="collapse-head" onClick={() => setOpen((o) => ({ ...o, [df.code]: !o[df.code] }))}>
              <span className={`caret ${isOpen ? 'open' : ''}`}><Icon name="chevron" size={15} /></span>
              <strong style={{ fontFamily: 'var(--serif)' }}>{df.code} · {df.name}</strong>
              <span className="muted" style={{ fontSize: 12 }}>{rows.length} factors · {dfActive} active</span>
              <span style={{ flex: 1 }} />
              <span className="muted" style={{ fontSize: 12 }}>{rows.filter((r) => r.selectionType === 'policy-required').length} locked</span>
            </div>
            {isOpen && (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Leaf Factor</th>
                      <th>Policy Status</th>
                      <th>Selection</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const isNa = r.selectionType === 'not-applicable'
                      const isLocked = r.locked
                      const isUpgraded = r.ruleStatus === 'Mandatory' && r.base !== 'Mandatory'
                      const selInfo = SELECTION_LABELS[r.selectionType]
                      return (
                        <tr
                          key={r.code}
                          className={`row-clickable ${isNa ? 'na-row' : ''} ${isUpgraded ? 'row-upgraded' : ''}`}
                          onClick={() => setSelected(r)}
                        >
                          <td className="mono muted">{r.code}</td>
                          <td>
                            <strong style={{ fontWeight: 600 }}>{r.name}</strong>
                            <div className="mono muted" style={{ fontSize: 11 }}>{r.field}</div>
                          </td>
                          <td>
                            <ApplicabilityPill status={r.ruleStatus} />
                            {isUpgraded && (
                              <div style={{ fontSize: 11, color: 'var(--pass)', marginTop: 2 }}>↑ from {r.base}</div>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            {isLocked ? (
                              <span className="flex center gap4" style={{ fontSize: 12 }}>
                                <span>{selInfo.icon}</span>
                                <span className="muted">{selInfo.label}</span>
                              </span>
                            ) : (
                              <label className="flex center gap6" style={{ cursor: 'pointer', fontSize: 13 }}>
                                <input
                                  type="checkbox"
                                  checked={r.includedInEvaluation}
                                  onChange={(e) => setUserSelection(r.code, e.target.checked)}
                                  style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                                />
                                <span>{r.includedInEvaluation ? 'Included' : 'Excluded'}</span>
                              </label>
                            )}
                          </td>
                          <td><span className="muted" style={{ fontSize: 11 }}>trace ›</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )
      })}

      {/* ──── Live readiness preview + Save as Scenario ──── */}
      <Card>
        <div className="card-head">
          <div className="card-title">Live readiness preview</div>
          <div className="card-hint">Evaluating {activeCount} of {applicableCount} applicable factors</div>
        </div>
        <div className="card-pad col gap12">
          {/* Part A — per-supplier readiness + delta vs the no-selection baseline */}
          <div className="col">
            {result.suppliers.map((s) => {
              const base = baseline.suppliers.find((x) => x.id === s.id)!
              const dPts = (s.readiness - base.readiness) * 100
              return (
                <div key={s.id} className="between" style={{ padding: '6px 0', borderBottom: '1px dashed var(--border)' }}>
                  <span className="flex center gap8">
                    <span style={{ width: 9, height: 9, borderRadius: 3, background: SUPPLIER_COLORS[s.id] }} />
                    <strong>{s.id}</strong>
                    <span className="muted" style={{ fontSize: 12 }}>{s.name}</span>
                  </span>
                  <span className="flex center gap12">
                    <span className="readiness-num" style={{ fontSize: 16 }}>{(s.readiness * 100).toFixed(1)}%</span>
                    <LabelPill label={s.label} />
                    <span className={`mono ${dPts > 0.05 ? 'delta-up' : dPts < -0.05 ? 'delta-down' : 'delta-na'}`} style={{ fontSize: 12, fontWeight: 600, minWidth: 70, textAlign: 'right' }}>
                      {dPts > 0.05 ? '▲' : dPts < -0.05 ? '▼' : '–'} {dPts >= 0 ? '+' : ''}{dPts.toFixed(1)} pts
                    </span>
                  </span>
                </div>
              )
            })}
            <div className="muted" style={{ fontSize: 11, marginTop: 6 }}>Δ vs the baseline with no user selections (default policy scope).</div>
          </div>

          {/* Part B — save as scenario */}
          <div className="flex center gap8">
            <input
              type="text"
              placeholder="Name this scenario, e.g. Quality Focus"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveScenario()}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
            />
            <button className="chip-btn active" onClick={handleSaveScenario} disabled={!scenarioName.trim() || savedFlash}>
              {savedFlash ? 'Saved ✓' : 'Save as Scenario'}
            </button>
          </div>

          {/* Part C — navigation hint */}
          <div className="muted" style={{ fontSize: 12 }}>
            <a onClick={() => onNavigate?.('scenario')} style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>
              Go to Scenario Impact to compare saved scenarios.
            </a>
          </div>
        </div>
      </Card>

      {/* ──── Impact Analyzer ──── */}
      <Card>
        <div
          className="collapse-head"
          onClick={() => setShowImpact((v) => !v)}
        >
          <span className={`caret ${showImpact ? 'open' : ''}`}><Icon name="chevron" size={15} /></span>
          <strong style={{ fontFamily: 'var(--serif)' }}>What-If Impact Analyzer</strong>
          <span className="muted" style={{ fontSize: 12 }}>{inactiveNonNa} inactive factor{inactiveNonNa === 1 ? '' : 's'} to analyze</span>
        </div>
        {showImpact && (
          <div className="table-wrap">
            {sortedImpacts.length === 0 ? (
              <div className="muted" style={{ padding: 24, textAlign: 'center' }}>
                All available factors are already included in the evaluation.
              </div>
            ) : (
              <table className="data">
                <thead>
                  <tr>
                    <th>Factor</th>
                    <th>Readiness Impact (Σ all suppliers)</th>
                    <th>Confidence Impact</th>
                    <th>Risk Blind Spot</th>
                    <th>Missing Data Source</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {sortedImpacts.map(({ imp, total }) => {
                    const totalPts = total * 100
                    const confPts = (imp.confidenceDelta * 100)
                    return (
                      <tr key={imp.code}>
                        <td>
                          <strong style={{ fontWeight: 600 }}>{imp.name}</strong>
                          <div className="mono muted" style={{ fontSize: 11 }}>{imp.code} · {imp.df}</div>
                        </td>
                        <td>
                          <span className={`mono ${totalPts > 0.05 ? 'delta-up' : totalPts < -0.05 ? 'delta-down' : ''}`} style={{ fontSize: 13, fontWeight: 600 }}>
                            {totalPts > 0.05 ? '▲' : totalPts < -0.05 ? '▼' : '–'} {Math.abs(totalPts).toFixed(1)} pts
                          </span>
                          <div className="flex" style={{ gap: 7, marginTop: 3, flexWrap: 'wrap' }}>
                            {result.suppliers.map((s) => {
                              const d = (imp.readinessDelta[s.id] ?? 0) * 100
                              return (
                                <span key={s.id} className="mono muted" style={{ fontSize: 10.5 }} title={s.name}>
                                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: 2, background: SUPPLIER_COLORS[s.id], marginRight: 3 }} />
                                  {d >= 0 ? '+' : ''}{d.toFixed(1)}
                                </span>
                              )
                            })}
                          </div>
                        </td>
                        <td>
                          <span className="mono" style={{ fontSize: 13, color: 'var(--pass)', fontWeight: 600 }}>+{confPts.toFixed(1)}%</span>
                        </td>
                        <td style={{ maxWidth: 260 }}>
                          <span style={{ fontSize: 12.5 }}>{imp.riskBlindSpot}</span>
                        </td>
                        <td>
                          <span className="pill" style={{ fontSize: 11, background: 'var(--accent-soft)', color: 'var(--accent)' }}>
                            {imp.missingDataSource}
                          </span>
                        </td>
                        <td>
                          <button
                            className="chip-btn active"
                            style={{ fontSize: 11, padding: '4px 10px' }}
                            onClick={() => setUserSelection(imp.code, true)}
                          >
                            + Include
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Card>

      {selected && <TraceDrawer factor={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

function TraceDrawer({ factor, onClose }: { factor: FactorApplicability; onClose: () => void }) {
  const selInfo = SELECTION_LABELS[factor.selectionType]
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer">
        <div className="drawer-head between">
          <div>
            <div className="muted mono" style={{ fontSize: 12 }}>{factor.code} · {factor.df}</div>
            <h3 style={{ fontSize: 18, marginTop: 4 }}>{factor.name}</h3>
            <div className="mono muted" style={{ fontSize: 12, marginTop: 4 }}>{factor.field}</div>
          </div>
          <button className="icon-btn" onClick={onClose}><Icon name="close" /></button>
        </div>
        <div className="drawer-body">
          <div className="between" style={{ marginBottom: 12 }}>
            <span className="muted">Base status: <strong>{factor.base}</strong></span>
            <ApplicabilityPill status={factor.ruleStatus} />
          </div>
          <div className="between" style={{ marginBottom: 16 }}>
            <span className="muted">Selection type:</span>
            <span className={`pill ${selInfo.cls}`}>{selInfo.icon} {selInfo.label}</span>
          </div>
          <div className="between" style={{ marginBottom: 16 }}>
            <span className="muted">Included in evaluation:</span>
            <strong>{factor.includedInEvaluation ? 'Yes' : 'No'}</strong>
          </div>
          {factor.locked && (
            <div className="pill" style={{ marginBottom: 16, background: 'var(--panel-soft)', display: 'inline-block', fontSize: 11 }}>
              🔒 This factor is locked by policy and cannot be changed by users
            </div>
          )}
          <div className="section-label">Reason trace — rules evaluated in order</div>
          <ul className="trace">
            {factor.reason.map((step, i) => (
              <li key={i}>
                <span className="trace-step">{i + 1}</span>
                <div>
                  <div className="trace-rule">{step.rule}</div>
                  <div className="trace-detail">{step.detail}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="divider" />
          <p className="muted" style={{ fontSize: 12 }}>
            Rules fire in fixed precedence: Not Applicable → Mandatory → Conditional → Default, then Criticality and Strategy upgrades.
            The first rule that fires sets the status; a Not Applicable result is final and cannot be upgraded.
          </p>
        </div>
      </aside>
    </>
  )
}
