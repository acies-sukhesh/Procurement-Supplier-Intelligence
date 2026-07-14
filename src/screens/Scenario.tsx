import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../state/store'
import { evaluate } from '../engine/evaluate'
import { buildSkipImpacts } from '../engine/projection'
import { whyItMatters } from '../engine/evidence'
import strategies from '../data/strategies.json'
import { Card, LabelPill, SUPPLIER_COLORS } from '../components/ui'
import type { DFCode, EvaluationResult, ReadinessLabel, RequestContext, SavedScenario } from '../engine/types'

// Scenario weight presets. Named presets reuse strategies.json weight sets;
// Cost-first is a financial-weighted set (sums to 100, no ROI math).
const PRESETS: { label: string; strategyId?: string; weights?: Record<DFCode, number> }[] = [
  { label: 'Quality-first', strategyId: 'Quality & Risk' },
  { label: 'Cost-first', weights: { DF1: 5, DF2: 5, DF3: 15, DF4: 15, DF5: 35, DF6: 15, DF7: 10 } },
  { label: 'Risk-first', strategyId: 'Risk & Continuity' },
  { label: 'Delivery-first', strategyId: 'Delivery' },
  { label: 'Balanced', strategyId: 'Balanced' },
  { label: 'Custom' },
]

const LABEL_ORDER: ReadinessLabel[] = ['Best-fit Shortlist', 'Conditional', 'Needs Review', 'Low Fit', 'Critical Flag / Review']

const DF_KEYS: DFCode[] = ['DF1', 'DF2', 'DF3', 'DF4', 'DF5', 'DF6', 'DF7']

// Resolvable preset weight vectors (Custom has no weights → excluded).
const PRESET_VECTORS: { label: string; weights: Record<DFCode, number> }[] = PRESETS.flatMap((p) => {
  const w = p.strategyId
    ? (strategies as { id: string; weights: Record<DFCode, number> }[]).find((s) => s.id === p.strategyId)?.weights
    : p.weights
  return w ? [{ label: p.label, weights: w }] : []
})

// Section C: nearest preset by Euclidean distance over the 7 DF weights.
function nearestPreset(weights: Record<DFCode, number>): { label: string; distance: number } {
  let label = PRESET_VECTORS[0].label
  let distance = Infinity
  for (const pv of PRESET_VECTORS) {
    const d = Math.sqrt(DF_KEYS.reduce((s, df) => s + Math.pow((weights[df] ?? 0) - pv.weights[df], 2), 0))
    if (d < distance) { distance = d; label = pv.label }
  }
  return { label, distance }
}

// Section C (view-side): distance from a weight vector to every preset. Nothing
// is stored in the memo — the numbers derive from comparison.s1/s2.weights.
function presetDistances(weights: Record<DFCode, number>) {
  const rows = PRESET_VECTORS.map((pv) => ({
    label: pv.label,
    distance: Math.sqrt(DF_KEYS.reduce((s, df) => s + Math.pow((weights[df] ?? 0) - pv.weights[df], 2), 0)),
  }))
  return { rows, maxDistance: Math.max(...rows.map((r) => r.distance)) }
}
const sameWeights = (a: Record<DFCode, number>, b: Record<DFCode, number>) => DF_KEYS.every((k) => a[k] === b[k])
// Ordered color list for coloring bars by scenario index when >2 scenarios are compared.
const SCENARIO_COLORS = Object.values(SUPPLIER_COLORS)

// Human-readable label for each request-context field that can differ between scenarios.
const CTX_LABELS: Partial<Record<keyof RequestContext, string>> = {
  part_criticality: 'Criticality', industry: 'Industry', sourcing_strategy: 'Strategy',
  process_type: 'Process', required_qms: 'QMS', production_intent: 'Production',
  special_process_required: 'Special process', cross_border_sourcing: 'Cross-border',
  design_or_ip_shared: 'Design/IP shared', customer_esg_mandate: 'ESG mandate',
  abac_mandated: 'ABAC', contract_insurance_required: 'Insurance',
  mandated_commodity_or_ethics_requirement: 'Ethics mandate', region_blocked_or_sanctioned: 'Region blocked',
  monthly_demand: 'Demand',
}
function contextDiff(a: RequestContext, b: RequestContext): string {
  const parts: string[] = []
  for (const k of Object.keys(CTX_LABELS) as (keyof RequestContext)[]) {
    if (a[k] !== b[k]) parts.push(`${CTX_LABELS[k]} ${a[k]}→${b[k]}`)
  }
  return parts.join(', ')
}

const avgReadiness = (res: EvaluationResult) => res.suppliers.reduce((s, x) => s + x.readiness, 0) / res.suppliers.length

export default function Scenario() {
  const { savedScenarios, saveScenario, deleteScenario, loadScenario, setContext } = useStore()
  const [toast, setToast] = useState<string | null>(null)
  const [scenarioName, setScenarioName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<'name' | 'readiness' | 'label'>('readiness')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showComparison, setShowComparison] = useState(false)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  // Selected scenarios in *selection order* (first checked = S1, second = S2).
  const orderedSelected = useMemo(
    () => selectedIds.map((id) => savedScenarios.find((s) => s.id === id)).filter((s): s is SavedScenario => !!s),
    [selectedIds, savedScenarios],
  )

  // ── "Generate Comparison" analysis (Sections A–D). Compute-heavy, so gated
  // behind the button via showComparison; recomputes only while open. ──────────
  const comparison = useMemo(() => {
    if (!showComparison || orderedSelected.length < 2) return null
    const evals = orderedSelected.map((sc) => ({ sc, res: evaluate(sc.context, {}, sc.userSelections) }))
    const suppliers = evals[0].res.suppliers.map((s) => ({ id: s.id, name: s.name }))

    // Section C — nearest preset per selected scenario (spans all selected).
    const presetAlignment = evals.map(({ sc }) => ({ id: sc.id, name: sc.name, ...nearestPreset(sc.weights) }))

    // Sections B & D operate pairwise on S1 (first checked) and S2 (second checked).
    const [A, B] = evals
    const appB = new Map(B.res.applicability.map((a) => [a.code, a]))

    // Per-scenario skip-impact map (aggregate readiness drop across suppliers).
    const skipMap = (e: typeof A) => {
      const m = new Map<string, { total: number; per: Record<string, number> }>()
      for (const s of e.res.suppliers) {
        for (const imp of buildSkipImpacts(e.sc.context, {}, s)) {
          const cur = m.get(imp.code) ?? { total: 0, per: {} }
          cur.total += imp.delta
          cur.per[s.id] = imp.delta
          m.set(imp.code, cur)
        }
      }
      return m
    }
    const skipA = skipMap(A)
    const skipB = skipMap(B)

    // Section B — differing factors, each tagged with a controllable-vs-engine reason.
    const diffs = A.res.applicability
      .map((a) => {
        const b = appB.get(a.code)!
        const inclDiff = a.includedInEvaluation !== b.includedInEvaluation
        const ruleDiff = a.ruleStatus !== b.ruleStatus
        if (!inclDiff && !ruleDiff) return null
        const impA = a.includedInEvaluation ? (skipA.get(a.code)?.total ?? 0) : 0
        const impB = b.includedInEvaluation ? (skipB.get(a.code)?.total ?? 0) : 0
        const useA = Math.abs(impA) >= Math.abs(impB)
        const impact = useA ? impA : impB
        // Per-supplier impact from the scenario that contributes the shown impact.
        const per: Record<string, number> =
          (useA
            ? (a.includedInEvaluation ? skipA.get(a.code)?.per : undefined)
            : (b.includedInEvaluation ? skipB.get(a.code)?.per : undefined)) ?? {}
        const includedIn = [a.includedInEvaluation ? A.sc.name : null, b.includedInEvaluation ? B.sc.name : null].filter(Boolean) as string[]
        let reason: string
        if (ruleDiff) {
          const cd = contextDiff(A.sc.context, B.sc.context)
          reason = `Engine: ${cd || 'inputs differ'} (${a.ruleStatus} → ${b.ruleStatus})`
        } else {
          reason = `User excluded in ${a.includedInEvaluation ? B.sc.name : A.sc.name}`
        }
        return { code: a.code, name: a.name, df: a.df, includedIn, impact, per, reason }
      })
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .sort((x, y) => Math.abs(y.impact) - Math.abs(x.impact))

    // Section B — honest-disclosure numbers (real spread + real lock counts).
    const spread = suppliers.reduce((sum, sp) => {
      const ra = A.res.suppliers.find((s) => s.id === sp.id)!.readiness
      const rb = B.res.suppliers.find((s) => s.id === sp.id)!.readiness
      return sum + Math.abs(ra - rb)
    }, 0) / suppliers.length
    const lockStats = (e: typeof A) => {
      const app = e.res.applicability
      return {
        inScope: app.filter((a) => a.selectionType !== 'not-applicable').length,
        locked: app.filter((a) => a.selectionType === 'policy-required').length,
        selectable: app.filter((a) => a.selectionType === 'system-recommended' || a.selectionType === 'optional').length,
        criticality: e.sc.context.part_criticality,
      }
    }
    const lsA = lockStats(A), lsB = lockStats(B)
    const banner = lsA.locked >= lsB.locked ? lsA : lsB
    const showBanner = spread < 0.005 // < 0.5 pt average

    // Section D — lower-average-readiness scenario: top-3 excluded factors by add gain.
    const target = avgReadiness(A.res) <= avgReadiness(B.res) ? A : B
    const excluded = target.res.applicability.filter((a) => !a.includedInEvaluation && a.selectionType !== 'not-applicable')
    const gains = excluded
      .map((a) => {
        const sim = evaluate(target.sc.context, {}, { ...target.sc.userSelections, [a.code]: true })
        const per: Record<string, number> = {}
        let total = 0
        for (const s of target.res.suppliers) {
          const g = sim.suppliers.find((x) => x.id === s.id)!.readiness - s.readiness
          per[s.id] = g
          total += g
        }
        return { code: a.code, name: a.name, df: a.df, field: a.field, total, per }
      })
      .sort((x, y) => y.total - x.total)
      .slice(0, 3)

    return { evals, suppliers, presetAlignment, s1: A.sc, s2: B.sc, diffs, spread, banner, showBanner, target: target.sc, gains }
  }, [showComparison, orderedSelected])

  // ── Preset weight sets: apply DF weights in one setContext call, then rebaseline ─
  const applyPreset = (p: (typeof PRESETS)[number]) => {
    if (p.label === 'Custom') return
    const weights = p.strategyId
      ? (strategies as { id: string; weights: Record<DFCode, number> }[]).find((s) => s.id === p.strategyId)?.weights
      : p.weights
    if (!weights) return
    setContext({ sourcing_strategy: p.strategyId ?? 'Custom', customWeights: weights })
    setToast(`Applied ${p.label} preset`)
  }

  // ── All saved scenarios evaluated live → best-fit supplier per scenario ─
  const savedResults = useMemo(() => {
    return savedScenarios.map((sc) => {
      const r = evaluate(sc.context, {}, sc.userSelections)
      const noFlag = r.suppliers.filter((s) => s.criticalFlags.length === 0)
      const pool = noFlag.length ? noFlag : r.suppliers
      const best = pool.reduce((a, b) => (b.readiness > a.readiness ? b : a))
      return { id: sc.id, name: sc.name, bestId: best.id, readiness: best.readiness, label: best.label }
    })
  }, [savedScenarios])

  const sortedSaved = useMemo(() => {
    const arr = [...savedResults]
    arr.sort((a, b) => {
      const cmp =
        sortKey === 'name' ? a.name.localeCompare(b.name)
        : sortKey === 'readiness' ? a.readiness - b.readiness
        : LABEL_ORDER.indexOf(a.label) - LABEL_ORDER.indexOf(b.label)
      return sortDir === 'asc' ? cmp : -cmp
    })
    return arr
  }, [savedResults, sortKey, sortDir])

  const toggleSort = (key: 'name' | 'readiness' | 'label') => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir(key === 'label' ? 'asc' : 'desc') }
  }
  const sortArrow = (key: string) => (sortKey === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '')

  const handleSave = () => {
    if (!scenarioName.trim()) return
    saveScenario(scenarioName.trim())
    setScenarioName('')
    setToast('Scenario saved successfully.')
  }

  const toggleScenario = (id: string) => {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    )
  }

  return (
    <div className="col gap16">
      {/* ── Scenario Library ── */}
      <Card>
        <div className="card-head"><div className="card-title">Scenario Library</div><div className="card-hint">{savedScenarios.length} saved</div></div>
        <div className="card-pad">
          {/* Preset weight chips */}
          <div className="flex center" style={{ gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12 }}>Weight presets:</span>
            {PRESETS.map((p) => (
              <button key={p.label} className="chip-btn" onClick={() => applyPreset(p)}>{p.label}</button>
            ))}
          </div>
          {/* Save current */}
          <div className="flex center gap8" style={{ marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Scenario name (e.g. Quality Focus)"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
            />
            <button className="chip-btn active" onClick={handleSave} disabled={!scenarioName.trim()}>
              Save Current
            </button>
          </div>

          {savedScenarios.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, textAlign: 'center', padding: 12 }}>
              No saved scenarios yet. Adjust evaluation settings and save them here for comparison.
            </p>
          ) : (
            <div className="col gap8">
              {savedScenarios.map((sc) => {
                const isSelected = selectedIds.includes(sc.id)
                const selCount = Object.values(sc.userSelections).filter(Boolean).length
                return (
                  <div
                    key={sc.id}
                    className="card"
                    style={{
                      padding: '10px 14px',
                      border: isSelected ? '2px solid var(--accent)' : '1px solid var(--border)',
                      background: isSelected ? 'var(--accent-soft)' : 'var(--white)',
                      display: 'flex', alignItems: 'center', gap: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleScenario(sc.id)}
                      style={{ width: 16, height: 16, accentColor: 'var(--accent)' }}
                    />
                    <div style={{ flex: 1 }}>
                      <strong style={{ fontSize: 14 }}>{sc.name}</strong>
                      <div className="muted" style={{ fontSize: 11 }}>
                        {sc.context.sourcing_strategy} · {sc.context.part_criticality} · {sc.context.industry}
                        {selCount > 0 && ` · ${selCount} user-added factors`}
                      </div>
                    </div>
                    <span className="muted" style={{ fontSize: 11 }}>
                      {new Date(sc.timestamp).toLocaleDateString()} {new Date(sc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <button className="chip-btn" onClick={() => { loadScenario(sc.id); setToast(`Loaded "${sc.name}"`) }} style={{ fontSize: 11 }}>Load</button>
                    <button className="chip-btn" onClick={() => deleteScenario(sc.id)} style={{ fontSize: 11, color: 'var(--critical)' }}>Delete</button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Sortable outcome table across all saved scenarios */}
          {savedScenarios.length >= 2 && (
            <div style={{ marginTop: 18 }}>
              <div className="section-label">Scenario outcomes — best-fit supplier per scenario</div>
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>Scenario{sortArrow('name')}</th>
                      <th>Best-fit supplier</th>
                      <th onClick={() => toggleSort('readiness')} style={{ cursor: 'pointer' }}>Readiness{sortArrow('readiness')}</th>
                      <th onClick={() => toggleSort('label')} style={{ cursor: 'pointer' }}>Label{sortArrow('label')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSaved.map((r) => (
                      <tr key={r.id}>
                        <td><strong style={{ fontWeight: 600 }}>{r.name}</strong></td>
                        <td>
                          <span className="flex center gap8">
                            <span style={{ width: 9, height: 9, borderRadius: 3, background: SUPPLIER_COLORS[r.bestId] }} />
                            <strong>{r.bestId}</strong>
                          </span>
                        </td>
                        <td className="mono">{(r.readiness * 100).toFixed(1)}%</td>
                        <td><LabelPill label={r.label} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {savedScenarios.length >= 2 && (
            <div className="flex center" style={{ gap: 10, marginTop: 16 }}>
              <button className="chip-btn active" disabled={orderedSelected.length < 2} onClick={() => setShowComparison(true)}>
                Generate Comparison
              </button>
              <span className="muted" style={{ fontSize: 12 }}>
                {orderedSelected.length < 2
                  ? 'Tick at least 2 scenarios above (in the order you want S1 ↔ S2), then generate.'
                  : `Comparing ${orderedSelected.length} selected — S1 = ${orderedSelected[0].name}, S2 = ${orderedSelected[1].name}.`}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* ══ Generate Comparison — Sections A–D ══ */}
      {comparison && (
        <>
          {/* Section A — grouped bar chart */}
          <Card>
            <div className="card-head"><div className="card-title">A · Readiness by supplier</div><div className="card-hint">{comparison.evals.length} scenarios × {comparison.suppliers.length} suppliers</div></div>
            <div className="card-pad">
              <div className="flex" style={{ gap: 20, alignItems: 'flex-end', overflowX: 'auto', paddingBottom: 4 }}>
                {comparison.suppliers.map((sup) => {
                  const two = comparison.evals.length === 2
                  const r0 = comparison.evals[0].res.suppliers.find((x) => x.id === sup.id)!.readiness
                  const rLast = comparison.evals[comparison.evals.length - 1].res.suppliers.find((x) => x.id === sup.id)!.readiness
                  const dPts = (rLast - r0) * 100 // S2 − S1 for the 2-scenario case
                  return (
                    <div key={sup.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 68 }}>
                      {two && (
                        <span className={`mono ${dPts > 0.05 ? 'delta-up' : dPts < -0.05 ? 'delta-down' : 'delta-na'}`} style={{ fontSize: 11, fontWeight: 600, marginBottom: 4 }}>
                          {dPts >= 0 ? '+' : ''}{dPts.toFixed(1)}%
                        </span>
                      )}
                      <div className="flex" style={{ gap: 5, alignItems: 'flex-end', height: 150 }}>
                        {comparison.evals.map(({ sc, res }, k) => {
                          const rd = res.suppliers.find((x) => x.id === sup.id)!.readiness
                          const color = two ? SUPPLIER_COLORS[sup.id] : SCENARIO_COLORS[k % SCENARIO_COLORS.length]
                          const opacity = two ? (k === 0 ? 1 : 0.6) : Math.max(0.35, 1 - k * 0.2)
                          return (
                            <div key={sc.id} title={`${sc.name}: ${(rd * 100).toFixed(1)}%`}
                              style={{ width: two ? 22 : 16, height: `${rd * 100}%`, background: color, opacity, borderRadius: '3px 3px 0 0' }} />
                          )
                        })}
                      </div>
                      <span className="mono" style={{ fontSize: 11, fontWeight: 600, marginTop: 5 }}>{sup.id}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex center" style={{ gap: 14, marginTop: 12, flexWrap: 'wrap' }}>
                {comparison.evals.map(({ sc }, k) => {
                  const two = comparison.evals.length === 2
                  return (
                    <span key={sc.id} className="flex center gap6" style={{ fontSize: 11 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: two ? 'var(--ink)' : SCENARIO_COLORS[k % SCENARIO_COLORS.length], opacity: two ? (k === 0 ? 1 : 0.6) : Math.max(0.35, 1 - k * 0.2) }} />
                      <span className="muted">{sc.name}</span>
                    </span>
                  )
                })}
              </div>
            </div>
          </Card>

          {/* Section B — tornado chart */}
          <Card>
            <div className="card-head">
              <div className="card-title">B · Factor differences — {comparison.s1.name} ↔ {comparison.s2.name}</div>
              <div className="card-hint">{comparison.diffs.length} differing</div>
            </div>
            {comparison.showBanner && (
              <div className="card-pad" style={{ paddingBottom: 0 }}>
                <div className="pill watch" style={{ display: 'block', padding: '10px 12px', fontSize: 12.5, whiteSpace: 'normal', lineHeight: 1.5 }}>
                  These two scenarios differ by {(comparison.spread * 100).toFixed(1)} pts on average because {comparison.banner.criticality} criticality locks {comparison.banner.locked} of {comparison.banner.inScope} factors — only {comparison.banner.selectable} remain user-selectable. To see meaningful differences, try saving a scenario with Medium criticality.
                </div>
              </div>
            )}
            {comparison.diffs.length === 0 ? (
              <div className="card-pad muted">No factor differences between these two scenarios.</div>
            ) : (
              <div className="card-pad">
                {(() => {
                  const maxImpact = Math.max(...comparison.diffs.map((d) => Math.abs(d.impact))) || 1
                  return comparison.diffs.map((d) => {
                    const onlyS1 = d.includedIn.length === 1 && d.includedIn[0] === comparison.s1.name
                    const onlyS2 = d.includedIn.length === 1 && d.includedIn[0] === comparison.s2.name
                    // only-in-S1 → left (loss if removed from S2); only-in-S2 → right (gain).
                    // both-included but ruleStatus differs → fall back to impact sign.
                    const dir = onlyS1 ? 'left' : onlyS2 ? 'right' : d.impact < 0 ? 'left' : 'right'
                    const width = (Math.abs(d.impact) / maxImpact) * 50 // half-track max
                    const color = dir === 'left' ? '#E24B4A' : '#1D9E75'
                    return (
                      <div key={d.code} style={{ marginBottom: 12 }}>
                        <div className="flex center" style={{ gap: 8 }}>
                          <div style={{ flex: 1, textAlign: 'right', fontSize: 12, minWidth: 0 }}>
                            <strong style={{ fontWeight: 600 }}>{d.name}</strong> <span className="mono muted" style={{ fontSize: 10.5 }}>{d.code}</span>
                          </div>
                          <div style={{ position: 'relative', flex: '0 0 300px', height: 18, background: 'var(--na-bg)', borderRadius: 4 }}>
                            <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 1, background: 'var(--border)' }} />
                            <div style={{ position: 'absolute', top: 3, bottom: 3, [dir === 'left' ? 'right' : 'left']: '50%', width: `${width}%`, background: color, borderRadius: 3 }} />
                          </div>
                          <div className="mono" style={{ flex: '0 0 62px', fontSize: 11, color }}>{(d.impact * 100).toFixed(1)} pts</div>
                        </div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 2, marginLeft: 4 }}>{d.reason}</div>
                      </div>
                    )
                  })
                })()}

                {/* Per-supplier dot row for the highest-impact factor */}
                <div style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 12 }}>
                  <div className="section-label" style={{ margin: '0 0 10px' }}>Per-supplier impact · {comparison.diffs[0].name}</div>
                  <div className="flex center" style={{ gap: 16, flexWrap: 'wrap' }}>
                    {comparison.suppliers.map((sup) => {
                      const v = (comparison.diffs[0].per[sup.id] ?? 0) * 100
                      const size = 14 + Math.min(Math.abs(v), 20)
                      const bg = v > 0.05 ? 'var(--pass-bg)' : v < -0.05 ? 'var(--below-bg)' : 'var(--na-bg)'
                      const bd = v > 0.05 ? 'var(--pass)' : v < -0.05 ? 'var(--below)' : 'var(--na)'
                      return (
                        <div key={sup.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 44 }}>
                          <div style={{ width: size, height: size, borderRadius: '50%', background: bg, border: `1.5px solid ${bd}` }} title={sup.name} />
                          <span className="mono muted" style={{ fontSize: 10 }}>{sup.id}</span>
                          <span className="mono" style={{ fontSize: 10.5, fontWeight: 600, color: bd }}>{v >= 0 ? '+' : ''}{v.toFixed(1)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Section C — horizontal distance bars */}
          <Card>
            <div className="card-head"><div className="card-title">C · Preset alignment</div><div className="card-hint">closest strategy by weight distance</div></div>
            <div className="card-pad col gap16">
              {(sameWeights(comparison.s1.weights, comparison.s2.weights)
                ? [{ label: 'Both scenarios', weights: comparison.s1.weights }]
                : [{ label: comparison.s1.name, weights: comparison.s1.weights }, { label: comparison.s2.name, weights: comparison.s2.weights }]
              ).map((row) => {
                const { rows: dists, maxDistance } = presetDistances(row.weights)
                const nearest = dists.reduce((a, b) => (b.distance < a.distance ? b : a))
                return (
                  <div key={row.label}>
                    <div className="section-label" style={{ margin: '0 0 8px' }}>{row.label}</div>
                    <div className="col gap8">
                      {dists.map((p) => {
                        const width = maxDistance === 0 ? 100 : (1 - p.distance / maxDistance) * 100
                        const isNearest = p.label === nearest.label
                        return (
                          <div key={p.label} className="flex center" style={{ gap: 10 }}>
                            <span style={{ flex: '0 0 96px', fontSize: 12, fontWeight: isNearest ? 700 : 400 }}>{p.label}</span>
                            <div style={{ flex: 1, height: 14, background: 'var(--na-bg)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${width}%`, height: '100%', background: isNearest ? 'var(--accent)' : 'var(--border)', borderRadius: 4 }} />
                            </div>
                            <span className="mono muted" style={{ flex: '0 0 44px', textAlign: 'right', fontSize: 11 }}>{p.distance.toFixed(1)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
              <p className="muted" style={{ fontSize: 11.5, margin: 0 }}>Longest bar = closest preset (distance 0 = perfect match). Identifies the strategy category, not which is best.</p>
            </div>
          </Card>

          {/* Section D — per-supplier dot chart */}
          <Card>
            <div className="card-head"><div className="card-title">D · Top improvement opportunities</div><div className="card-hint">{comparison.target.name} · lower average readiness</div></div>
            {comparison.gains.length === 0 ? (
              <div className="card-pad muted">All in-scope factors are already included in this scenario — no excluded factors to add.</div>
            ) : (
              <div className="card-pad col gap16">
                {comparison.gains.map((g) => (
                  <div key={g.code}>
                    <div className="between" style={{ marginBottom: 8 }}>
                      <span><strong style={{ fontWeight: 600 }}>{g.name}</strong> <span className="mono muted" style={{ fontSize: 11 }}>{g.code} · {g.df}</span></span>
                      <span className={`mono ${g.total > 0.0005 ? 'delta-up' : g.total < -0.0005 ? 'delta-down' : ''}`} style={{ fontSize: 13, fontWeight: 700 }}>{g.total >= 0 ? '+' : ''}{(g.total * 100).toFixed(1)} pts</span>
                    </div>
                    <div className="flex center" style={{ gap: 12, flexWrap: 'wrap' }}>
                      {comparison.suppliers.map((sup) => {
                        const v = (g.per[sup.id] ?? 0) * 100
                        const bg = v > 0.5 ? 'var(--pass-bg)' : v < -0.05 ? 'var(--below-bg)' : 'var(--border)'
                        return (
                          <div key={sup.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <div className="flex center" style={{ minWidth: 42, height: 26, padding: '0 8px', borderRadius: 13, background: bg, color: 'var(--ink)', fontSize: 11, fontWeight: 600 }} title={sup.name}>
                              {v >= 0 ? '+' : ''}{v.toFixed(1)}
                            </div>
                            <span className="mono muted" style={{ fontSize: 10 }}>{sup.id}</span>
                          </div>
                        )
                      })}
                    </div>
                    <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{whyItMatters(g.field)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {toast && <div className="toast">✓ {toast}</div>}
    </div>
  )
}
