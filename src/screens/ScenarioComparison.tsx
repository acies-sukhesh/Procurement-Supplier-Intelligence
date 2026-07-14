import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Paper from '@mui/material/Paper'
import Checkbox from '@mui/material/Checkbox'
import Divider from '@mui/material/Divider'
import Alert from '@mui/material/Alert'
import Snackbar from '@mui/material/Snackbar'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import { useTheme } from '@mui/material/styles'
import SaveRoundedIcon from '@mui/icons-material/SaveRounded'
import TuneRoundedIcon from '@mui/icons-material/TuneRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import FileUploadRoundedIcon from '@mui/icons-material/FileUploadRounded'
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded'
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded'
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded'
import TrackChangesRoundedIcon from '@mui/icons-material/TrackChangesRounded'
import TipsAndUpdatesRoundedIcon from '@mui/icons-material/TipsAndUpdatesRounded'
import ListAltRoundedIcon from '@mui/icons-material/ListAltRounded'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from 'recharts'
import { useStore } from '../state/store'
import { evaluate } from '../engine/evaluate'
import { buildSkipImpacts } from '../engine/projection'
import { whyItMatters } from '../engine/evidence'
import strategies from '../data/strategies.json'
import { SectionCard } from '../components/SectionCard'
import { KpiRow, KpiTile } from '../components/KpiTile'
import { ReadinessBadge } from '../components/StatusBadge'
import { SupplierAvatar } from '../components/SupplierAvatar'
import { AppDrawer } from '../components/AppDrawer'
import { EmptyState } from '../components/States'
import { SUPPLIER_COLORS } from '../theme'
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

type DiffDrawerState = { mode: 'all' } | { mode: 'one'; code: string }

export default function ScenarioComparison() {
  const { savedScenarios, saveScenario, deleteScenario, loadScenario, setContext } = useStore()
  const theme = useTheme()
  const [toast, setToast] = useState<string | null>(null)
  const [scenarioName, setScenarioName] = useState('')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [sortKey, setSortKey] = useState<'name' | 'readiness' | 'label'>('readiness')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showComparison, setShowComparison] = useState(false)
  const [diffDrawer, setDiffDrawer] = useState<DiffDrawerState | null>(null)

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

  // ── Section A chart data: one row per supplier, one numeric key per scenario id ─
  const chartDataA = useMemo(() => {
    if (!comparison) return []
    return comparison.suppliers.map((sup) => {
      const row: Record<string, string | number> = { id: sup.id, name: sup.name }
      comparison.evals.forEach(({ sc, res }) => {
        row[sc.id] = Number((res.suppliers.find((x) => x.id === sup.id)!.readiness * 100).toFixed(1))
      })
      return row
    })
  }, [comparison])

  // ── Section B tornado data: signed pts, negative = only-in-S1 / lost, positive = only-in-S2 / gained ─
  const tornadoData = useMemo(() => {
    if (!comparison) return []
    return comparison.diffs.map((d) => {
      const onlyS1 = d.includedIn.length === 1 && d.includedIn[0] === comparison.s1.name
      const onlyS2 = d.includedIn.length === 1 && d.includedIn[0] === comparison.s2.name
      const dir: 'left' | 'right' = onlyS1 ? 'left' : onlyS2 ? 'right' : d.impact < 0 ? 'left' : 'right'
      const value = Number(((dir === 'left' ? -Math.abs(d.impact) : Math.abs(d.impact)) * 100).toFixed(2))
      return { ...d, dir, value }
    })
  }, [comparison])

  const focusedDiff = diffDrawer?.mode === 'one' ? comparison?.diffs.find((d) => d.code === diffDrawer.code) : undefined

  return (
    <Stack spacing={2}>
      {/* ── Scenario Library ── */}
      <SectionCard
        title="Scenario Library"
        hint={`${savedScenarios.length} saved scenario${savedScenarios.length === 1 ? '' : 's'}`}
        icon={<TuneRoundedIcon />}
      >
        <Stack spacing={2}>
          {/* Preset weight chips */}
          <Stack component="div" direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
              Weight presets:
            </Typography>
            {PRESETS.map((p) => (
              <Chip
                key={p.label}
                label={p.label}
                size="small"
                variant="outlined"
                disabled={p.label === 'Custom'}
                onClick={() => applyPreset(p)}
              />
            ))}
          </Stack>

          {/* Save current */}
          <Stack direction="row" spacing={1}>
            <TextField
              size="small"
              fullWidth
              placeholder="Scenario name (e.g. Quality Focus)"
              value={scenarioName}
              onChange={(e) => setScenarioName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
            <Button
              variant="contained"
              startIcon={<SaveRoundedIcon />}
              onClick={handleSave}
              disabled={!scenarioName.trim()}
              sx={{ flexShrink: 0 }}
            >
              Save Current
            </Button>
          </Stack>

          {/* Scenario list — card/list with checkboxes, preserves multi-select order (S1/S2) */}
          {savedScenarios.length === 0 ? (
            <EmptyState
              icon={<ListAltRoundedIcon fontSize="inherit" />}
              title="No saved scenarios yet"
              description="Adjust evaluation settings and save them here for comparison."
            />
          ) : (
            <Stack spacing={1} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
              {savedScenarios.map((sc) => {
                const isSelected = selectedIds.includes(sc.id)
                const selCount = Object.values(sc.userSelections).filter(Boolean).length
                return (
                  <Paper
                    key={sc.id}
                    component="li"
                    variant="outlined"
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      pl: 0.5,
                      pr: 1,
                      py: 0.5,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderWidth: isSelected ? 2 : 1,
                      bgcolor: isSelected ? 'rgba(22,87,201,0.05)' : 'background.paper',
                    }}
                  >
                    <Checkbox checked={isSelected} onChange={() => toggleScenario(sc.id)} size="small" />
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="subtitle2" fontWeight={700} noWrap>
                        {sc.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {sc.context.sourcing_strategy} · {sc.context.part_criticality} · {sc.context.industry}
                        {selCount > 0 && ` · ${selCount} user-added factors`}
                      </Typography>
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap', display: { xs: 'none', sm: 'block' } }}>
                      {new Date(sc.timestamp).toLocaleDateString()}{' '}
                      {new Date(sc.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                    <Tooltip title="Load into evaluation">
                      <IconButton size="small" onClick={() => { loadScenario(sc.id); setToast(`Loaded "${sc.name}"`) }}>
                        <FileUploadRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete scenario">
                      <IconButton size="small" color="error" onClick={() => deleteScenario(sc.id)}>
                        <DeleteOutlineRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Paper>
                )
              })}
            </Stack>
          )}

          {/* Sortable outcome table across all saved scenarios */}
          {savedScenarios.length >= 2 && (
            <Box>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>
                Scenario outcomes — best-fit supplier per scenario
              </Typography>
              <TableContainer variant="outlined" component={Paper} sx={{ mt: 0.5 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel active={sortKey === 'name'} direction={sortKey === 'name' ? sortDir : 'asc'} onClick={() => toggleSort('name')}>
                          Scenario
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>Best-fit supplier</TableCell>
                      <TableCell>
                        <TableSortLabel active={sortKey === 'readiness'} direction={sortKey === 'readiness' ? sortDir : 'asc'} onClick={() => toggleSort('readiness')}>
                          Readiness
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel active={sortKey === 'label'} direction={sortKey === 'label' ? sortDir : 'asc'} onClick={() => toggleSort('label')}>
                          Label
                        </TableSortLabel>
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedSaved.map((r) => (
                      <TableRow key={r.id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700}>{r.name}</Typography>
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <SupplierAvatar id={r.bestId} name={r.bestId} size={22} />
                            <Typography variant="body2" fontWeight={700}>{r.bestId}</Typography>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">{(r.readiness * 100).toFixed(1)}%</Typography>
                        </TableCell>
                        <TableCell><ReadinessBadge label={r.label} /></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {savedScenarios.length >= 2 && (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<InsightsRoundedIcon />}
                disabled={orderedSelected.length < 2}
                onClick={() => setShowComparison(true)}
              >
                Generate Comparison
              </Button>
              <Typography variant="caption" color="text.secondary">
                {orderedSelected.length < 2
                  ? 'Tick at least 2 scenarios above (in the order you want S1 ↔ S2), then generate.'
                  : `Comparing ${orderedSelected.length} selected — S1 = ${orderedSelected[0].name}, S2 = ${orderedSelected[1].name}.`}
              </Typography>
            </Stack>
          )}
        </Stack>
      </SectionCard>

      {/* ══ Generate Comparison — Sections A–D ══ */}
      {comparison && (
        <>
          <KpiRow>
            <KpiTile value={comparison.evals.length} label="Scenarios compared" icon={<CompareArrowsRoundedIcon />} />
            <KpiTile value={comparison.suppliers.length} label="Suppliers scored" icon={<BarChartRoundedIcon />} />
            <KpiTile value={comparison.diffs.length} label="Differing factors" icon={<TrackChangesRoundedIcon />} tone={comparison.diffs.length ? 'watch' : 'pass'} />
            <KpiTile value={`${(comparison.spread * 100).toFixed(1)} pts`} label="Avg readiness spread (S1 ↔ S2)" icon={<TipsAndUpdatesRoundedIcon />} />
          </KpiRow>

          {/* Section A — grouped bar chart */}
          <SectionCard
            title="A · Readiness by supplier"
            hint={`${comparison.evals.length} scenarios × ${comparison.suppliers.length} suppliers`}
          >
            <Box sx={{ height: Math.max(260, comparison.suppliers.length * 12) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartDataA} margin={{ left: 4, right: 12, top: 8 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                  <XAxis dataKey="id" tick={{ fill: theme.palette.text.secondary, fontSize: 12, fontWeight: 600 }} axisLine={{ stroke: theme.palette.divider }} tickLine={false} />
                  <YAxis domain={[0, 100]} unit="%" tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                  <RTooltip
                    formatter={(v: number, key: string) => [`${v}%`, comparison.evals.find((e) => e.sc.id === key)?.sc.name ?? key]}
                    labelFormatter={(l) => chartDataA.find((c) => c.id === l)?.name ?? l}
                  />
                  {comparison.evals.map(({ sc }, k) => {
                    const two = comparison.evals.length === 2
                    return (
                      <Bar key={sc.id} dataKey={sc.id} name={sc.name} radius={[3, 3, 0, 0]} maxBarSize={two ? 28 : 18}>
                        {chartDataA.map((row) => (
                          <Cell
                            key={row.id}
                            fill={two ? SUPPLIER_COLORS[row.id as string] ?? theme.palette.primary.main : SCENARIO_COLORS[k % SCENARIO_COLORS.length]}
                            fillOpacity={two ? (k === 0 ? 1 : 0.55) : Math.max(0.35, 1 - k * 0.2)}
                          />
                        ))}
                      </Bar>
                    )
                  })}
                </BarChart>
              </ResponsiveContainer>
            </Box>
            <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', mt: 1 }}>
              {comparison.evals.map(({ sc }, k) => {
                const two = comparison.evals.length === 2
                return (
                  <Stack key={sc.id} direction="row" spacing={0.75} alignItems="center">
                    <Box
                      sx={{
                        width: 10, height: 10, borderRadius: 0.5,
                        bgcolor: two ? theme.palette.text.primary : SCENARIO_COLORS[k % SCENARIO_COLORS.length],
                        opacity: two ? (k === 0 ? 1 : 0.55) : Math.max(0.35, 1 - k * 0.2),
                      }}
                    />
                    <Typography variant="caption" color="text.secondary">{sc.name}</Typography>
                  </Stack>
                )
              })}
            </Stack>
            {comparison.evals.length === 2 && (
              <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mt: 1.5 }}>
                {comparison.suppliers.map((sup) => {
                  const r0 = comparison.evals[0].res.suppliers.find((x) => x.id === sup.id)!.readiness
                  const rLast = comparison.evals[comparison.evals.length - 1].res.suppliers.find((x) => x.id === sup.id)!.readiness
                  const dPts = (rLast - r0) * 100
                  const tone = dPts > 0.05 ? theme.palette.status.pass.main : dPts < -0.05 ? theme.palette.status.critical.main : theme.palette.text.secondary
                  return (
                    <Chip
                      key={sup.id}
                      size="small"
                      label={`${sup.id} ${dPts >= 0 ? '+' : ''}${dPts.toFixed(1)}%`}
                      sx={{ color: tone, bgcolor: 'transparent', border: `1px solid ${tone}`, fontFamily: 'monospace' }}
                      variant="outlined"
                    />
                  )
                })}
              </Stack>
            )}
          </SectionCard>

          {/* Section B — tornado (diverging) chart of differing factors */}
          <SectionCard
            title={`B · Factor differences — ${comparison.s1.name} ↔ ${comparison.s2.name}`}
            hint={`${comparison.diffs.length} differing`}
            action={
              comparison.diffs.length > 0 && (
                <Button size="small" onClick={() => setDiffDrawer({ mode: 'all' })}>View all</Button>
              )
            }
          >
            {comparison.showBanner && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                These two scenarios differ by {(comparison.spread * 100).toFixed(1)} pts on average because {comparison.banner.criticality} criticality
                locks {comparison.banner.locked} of {comparison.banner.inScope} factors — only {comparison.banner.selectable} remain user-selectable.
                To see meaningful differences, try saving a scenario with Medium criticality.
              </Alert>
            )}
            {comparison.diffs.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No factor differences between these two scenarios.</Typography>
            ) : (
              <>
                <Box sx={{ height: Math.min(520, Math.max(200, tornadoData.length * 34)), maxHeight: 480, overflowY: tornadoData.length > 12 ? 'auto' : 'visible' }}>
                  <ResponsiveContainer width="100%" height={Math.max(200, tornadoData.length * 34)}>
                    <BarChart data={tornadoData} layout="vertical" margin={{ left: 8, right: 24 }} onClick={(state) => {
                      const code = (state as { activePayload?: { payload: { code: string } }[] })?.activePayload?.[0]?.payload?.code
                      if (code) setDiffDrawer({ mode: 'one', code })
                    }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={theme.palette.divider} />
                      <XAxis type="number" tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={{ stroke: theme.palette.divider }} tickLine={false} unit=" pts" />
                      <YAxis type="category" dataKey="name" width={170} tick={{ fill: theme.palette.text.primary, fontSize: 11.5, fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <ReferenceLine x={0} stroke={theme.palette.divider} />
                      <RTooltip
                        formatter={(v: number) => [`${v >= 0 ? '+' : ''}${v.toFixed(1)} pts`, 'Impact']}
                        labelFormatter={(l, payload) => {
                          const p = payload?.[0]?.payload as { code?: string } | undefined
                          return p?.code ? `${l} (${p.code})` : l
                        }}
                      />
                      <Bar dataKey="value" radius={3} maxBarSize={16} cursor="pointer">
                        {tornadoData.map((d) => (
                          <Cell key={d.code} fill={d.dir === 'left' ? theme.palette.status.critical.main : theme.palette.status.pass.main} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>

                {/* Per-supplier dot row for the highest-impact factor */}
                <Divider sx={{ my: 2 }} />
                <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>
                  Per-supplier impact · {comparison.diffs[0].name}
                </Typography>
                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', mt: 1 }}>
                  {comparison.suppliers.map((sup) => {
                    const v = (comparison.diffs[0].per[sup.id] ?? 0) * 100
                    const size = 14 + Math.min(Math.abs(v), 20)
                    const tone = v > 0.05 ? theme.palette.status.pass : v < -0.05 ? theme.palette.status.critical : theme.palette.status.locked
                    return (
                      <Stack key={sup.id} alignItems="center" spacing={0.5} sx={{ minWidth: 44 }}>
                        <Box sx={{ width: size, height: size, borderRadius: '50%', bgcolor: tone.bg, border: `1.5px solid ${tone.main}` }} title={sup.name} />
                        <Typography variant="caption" color="text.secondary" fontFamily="monospace">{sup.id}</Typography>
                        <Typography variant="caption" fontWeight={700} fontFamily="monospace" sx={{ color: tone.main }}>
                          {v >= 0 ? '+' : ''}{v.toFixed(1)}
                        </Typography>
                      </Stack>
                    )
                  })}
                </Stack>
              </>
            )}
          </SectionCard>

          {/* Section C — preset alignment (closeness bars) */}
          <SectionCard title="C · Preset alignment" hint="closest strategy by weight distance">
            <Stack spacing={3}>
              {(sameWeights(comparison.s1.weights, comparison.s2.weights)
                ? [{ label: 'Both scenarios', weights: comparison.s1.weights }]
                : [{ label: comparison.s1.name, weights: comparison.s1.weights }, { label: comparison.s2.name, weights: comparison.s2.weights }]
              ).map((row) => {
                const { rows: dists, maxDistance } = presetDistances(row.weights)
                const nearest = dists.reduce((a, b) => (b.distance < a.distance ? b : a))
                const chartRows = dists.map((p) => ({
                  label: p.label,
                  closeness: maxDistance === 0 ? 100 : Number(((1 - p.distance / maxDistance) * 100).toFixed(1)),
                  distance: p.distance,
                  isNearest: p.label === nearest.label,
                }))
                return (
                  <Box key={row.label}>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>{row.label}</Typography>
                    <Box sx={{ height: chartRows.length * 34 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartRows} layout="vertical" margin={{ left: 8, right: 40 }}>
                          <XAxis type="number" domain={[0, 100]} hide />
                          <YAxis type="category" dataKey="label" width={110} tick={{ fill: theme.palette.text.primary, fontSize: 11.5 }} axisLine={false} tickLine={false} />
                          <RTooltip formatter={(_v: number, _n: string, item) => [`distance ${(item.payload as { distance: number }).distance.toFixed(1)}`, 'Weight distance']} />
                          <Bar dataKey="closeness" radius={[0, 4, 4, 0]} maxBarSize={14}>
                            {chartRows.map((c) => (
                              <Cell key={c.label} fill={c.isNearest ? theme.palette.primary.main : theme.palette.divider} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                )
              })}
              <Typography variant="caption" color="text.secondary">
                Longest bar = closest preset (distance 0 = perfect match). Identifies the strategy category, not which is best.
              </Typography>
            </Stack>
          </SectionCard>

          {/* Section D — top improvement opportunities */}
          <SectionCard title="D · Top improvement opportunities" hint={`${comparison.target.name} · lower average readiness`}>
            {comparison.gains.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                All in-scope factors are already included in this scenario — no excluded factors to add.
              </Typography>
            ) : (
              <Stack spacing={3}>
                {comparison.gains.map((g) => {
                  const gainRows = comparison.suppliers.map((sup) => ({
                    id: sup.id,
                    name: sup.name,
                    value: Number(((g.per[sup.id] ?? 0) * 100).toFixed(1)),
                  }))
                  return (
                    <Box key={g.code}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="body2">
                          <Typography component="span" fontWeight={700}>{g.name}</Typography>{' '}
                          <Typography component="span" variant="caption" color="text.secondary" fontFamily="monospace">{g.code} · {g.df}</Typography>
                        </Typography>
                        <Chip
                          size="small"
                          label={`${g.total >= 0 ? '+' : ''}${(g.total * 100).toFixed(1)} pts`}
                          sx={{
                            color: g.total > 0.0005 ? theme.palette.status.pass.main : g.total < -0.0005 ? theme.palette.status.critical.main : theme.palette.text.secondary,
                            bgcolor: g.total > 0.0005 ? theme.palette.status.pass.bg : g.total < -0.0005 ? theme.palette.status.critical.bg : theme.palette.status.locked.bg,
                            fontFamily: 'monospace',
                          }}
                        />
                      </Stack>
                      <Box sx={{ height: 44 + gainRows.length * 30 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={gainRows} layout="vertical" margin={{ left: 8, right: 24 }}>
                            <XAxis type="number" tick={{ fill: theme.palette.text.secondary, fontSize: 11 }} axisLine={{ stroke: theme.palette.divider }} tickLine={false} unit="%" />
                            <YAxis type="category" dataKey="id" width={54} tick={{ fill: theme.palette.text.primary, fontSize: 11.5, fontWeight: 600 }} axisLine={false} tickLine={false} />
                            <ReferenceLine x={0} stroke={theme.palette.divider} />
                            <RTooltip formatter={(v: number) => [`${v >= 0 ? '+' : ''}${v}%`, 'Readiness gain']} labelFormatter={(l) => gainRows.find((r) => r.id === l)?.name ?? l} />
                            <Bar dataKey="value" radius={3} maxBarSize={16}>
                              {gainRows.map((r) => (
                                <Cell key={r.id} fill={r.value > 0.5 ? theme.palette.status.pass.main : r.value < -0.05 ? theme.palette.status.critical.main : theme.palette.status.locked.main} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>{whyItMatters(g.field)}</Typography>
                    </Box>
                  )
                })}
              </Stack>
            )}
          </SectionCard>
        </>
      )}

      {/* ── Factor-difference detail drawer (Section B) ── */}
      <AppDrawer
        open={diffDrawer !== null}
        onClose={() => setDiffDrawer(null)}
        title={diffDrawer?.mode === 'one' ? focusedDiff?.name ?? 'Factor detail' : 'All factor differences'}
        subtitle={diffDrawer?.mode === 'one' ? focusedDiff?.code : comparison ? `${comparison.diffs.length} differing factors` : undefined}
        width={460}
      >
        {diffDrawer?.mode === 'one' && focusedDiff && comparison && (
          <Stack spacing={2}>
            <Chip
              size="small"
              label={`${focusedDiff.impact >= 0 ? '+' : ''}${(focusedDiff.impact * 100).toFixed(1)} pts`}
              sx={{
                alignSelf: 'flex-start',
                color: focusedDiff.impact >= 0 ? theme.palette.status.pass.main : theme.palette.status.critical.main,
                bgcolor: focusedDiff.impact >= 0 ? theme.palette.status.pass.bg : theme.palette.status.critical.bg,
                fontFamily: 'monospace',
              }}
            />
            <Typography variant="body2" color="text.secondary">{focusedDiff.reason}</Typography>
            <Typography variant="caption" color="text.secondary">
              Included in: {focusedDiff.includedIn.length ? focusedDiff.includedIn.join(', ') : '—'}
            </Typography>
            <Divider />
            <Typography variant="overline" color="text.secondary">Per-supplier impact</Typography>
            <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
              {comparison.suppliers.map((sup) => {
                const v = (focusedDiff.per[sup.id] ?? 0) * 100
                const tone = v > 0.05 ? theme.palette.status.pass : v < -0.05 ? theme.palette.status.critical : theme.palette.status.locked
                return (
                  <Paper key={sup.id} variant="outlined" sx={{ px: 1.25, py: 0.75, textAlign: 'center' }}>
                    <SupplierAvatar id={sup.id} name={sup.name} size={22} />
                    <Typography variant="caption" fontWeight={700} fontFamily="monospace" sx={{ display: 'block', color: tone.main, mt: 0.5 }}>
                      {v >= 0 ? '+' : ''}{v.toFixed(1)}
                    </Typography>
                  </Paper>
                )
              })}
            </Stack>
          </Stack>
        )}
        {diffDrawer?.mode === 'all' && comparison && (
          <Stack spacing={0}>
            {comparison.diffs.map((d) => (
              <Box key={d.code} sx={{ py: 1.25, borderBottom: '1px solid', borderColor: 'divider', cursor: 'pointer' }} onClick={() => setDiffDrawer({ mode: 'one', code: d.code })}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="body2" fontWeight={600}>{d.name}</Typography>
                  <Typography
                    variant="caption"
                    fontFamily="monospace"
                    fontWeight={700}
                    sx={{ color: d.impact >= 0 ? theme.palette.status.pass.main : theme.palette.status.critical.main }}
                  >
                    {d.impact >= 0 ? '+' : ''}{(d.impact * 100).toFixed(1)} pts
                  </Typography>
                </Stack>
                <Typography variant="caption" color="text.secondary">{d.reason}</Typography>
              </Box>
            ))}
          </Stack>
        )}
      </AppDrawer>

      <Snackbar open={!!toast} autoHideDuration={2400} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" variant="filled" onClose={() => setToast(null)} sx={{ width: '100%' }}>
          {toast}
        </Alert>
      </Snackbar>
    </Stack>
  )
}
