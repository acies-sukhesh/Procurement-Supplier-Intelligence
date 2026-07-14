import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableFooter from '@mui/material/TableFooter'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import { useTheme } from '@mui/material/styles'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip as RechartsTooltip,
} from 'recharts'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'

import { useStore } from '../../state/store'
import { DF_CODES } from '../../engine/evaluate'
import decisionFactors from '../../data/decisionFactors.json'
import { SUPPLIER_COLORS } from '../../theme'
import { SectionCard } from '../../components/SectionCard'
import { KpiRow, KpiTile } from '../../components/KpiTile'
import { SupplierChip } from '../../components/SupplierAvatar'
import { ValidationBadge, ReadinessBadge, StatusBadge } from '../../components/StatusBadge'
import type { StatusTone } from '../../components/StatusBadge'
import type { SupplierResult, ValidationStatus } from '../../engine/types'

const TABS = [
  { id: 'factors', label: 'Factor Results' },
  { id: 'rollup', label: 'Readiness Roll-up' },
] as const

// Same status set the old Validation screen exposed as quick filters, in the order
// requested for this screen (all seven ValidationStatus values, plus "All").
const STATUS_FILTERS: Array<{ value: ValidationStatus | 'all'; label: string; tone?: StatusTone }> = [
  { value: 'all', label: 'All' },
  { value: 'Pass', label: 'Pass', tone: 'pass' },
  { value: 'Watch', label: 'Watch', tone: 'watch' },
  { value: 'Below Threshold', label: 'Below Threshold', tone: 'critical' },
  { value: 'Missing', label: 'Missing', tone: 'critical' },
  { value: 'Invalid', label: 'Invalid', tone: 'critical' },
  { value: 'Critical Flag', label: 'Critical Flag', tone: 'critical' },
  { value: 'Not Applicable', label: 'Not Applicable', tone: 'locked' },
]

// Merges the old Validation.tsx (per-factor status detail) and Aggregation.tsx
// (decision-factor roll-up + radar) into one tabbed "Supplier Evaluation" screen
// (flow step 6). Gap Register / missing-evidence content and the what-if readiness
// projection ladder are out of scope here — they live elsewhere in the redesigned flow.
export default function SupplierEvaluation({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { result } = useStore()
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('factors')
  const [active, setActive] = useState<string>(result.suppliers[0].id)
  const supplier = result.suppliers.find((s) => s.id === active) ?? result.suppliers[0]

  return (
    <Box>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2, borderBottom: '1px solid #E4E7EC' }}>
        {TABS.map((t) => (
          <Tab key={t.id} value={t.id} label={t.label} />
        ))}
      </Tabs>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        {result.suppliers.map((s) => (
          <SupplierChip key={s.id} id={s.id} name={s.name} selected={s.id === active} onClick={() => setActive(s.id)} />
        ))}
      </Stack>

      {tab === 'factors' && <FactorResultsTab supplier={supplier} />}
      {tab === 'rollup' && (
        <ReadinessRollupTab suppliers={result.suppliers} supplier={supplier} onNavigate={onNavigate} />
      )}
    </Box>
  )
}

// ── Tab 1: Factor Results (from Validation.tsx) ──────────────────────────────

function FactorResultsTab({ supplier }: { supplier: SupplierResult }) {
  const [filter, setFilter] = useState<ValidationStatus | 'all'>('all')
  const rows = supplier.factors.filter((f) => filter === 'all' || f.status === filter)

  return (
    <SectionCard
      title={`${supplier.id} · ${supplier.name} — factor detail`}
      hint="Validation status for every mandatory, conditional-active, and optional factor in scope."
      action={
        supplier.criticalFlags.length > 0 ? (
          <StatusBadge tone="critical" label={`${supplier.criticalFlags.length} critical flag${supplier.criticalFlags.length === 1 ? '' : 's'}`} />
        ) : undefined
      }
    >
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((f) => (
          <FilterChip key={f.value} active={filter === f.value} label={f.label} tone={f.tone} onClick={() => setFilter(f.value)} />
        ))}
      </Stack>

      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Factor</TableCell>
              <TableCell>DF</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Value</TableCell>
              <TableCell>Score</TableCell>
              <TableCell>Note</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((f) => (
              <TableRow key={f.code} hover sx={f.critical ? { bgcolor: 'status.critical.bg' } : undefined}>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{f.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{f.code}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{f.df}</Typography>
                </TableCell>
                <TableCell><ValidationBadge status={f.status} /></TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{f.displayValue}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{f.score === null ? '—' : f.score.toFixed(1)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">{f.note}</Typography>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                    No factors match this filter.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Box>
    </SectionCard>
  )
}

function FilterChip({ active, label, tone, onClick }: { active: boolean; label: string; tone?: StatusTone; onClick: () => void }) {
  const theme = useTheme()
  const color = tone ? theme.palette.status[tone].main : theme.palette.primary.main
  return (
    <Chip
      size="small"
      label={label}
      onClick={onClick}
      variant={active ? 'filled' : 'outlined'}
      sx={{
        fontWeight: 600,
        bgcolor: active ? color : 'transparent',
        color: active ? '#fff' : color,
        borderColor: color,
      }}
    />
  )
}

// ── Tab 2: Readiness Roll-up (from Aggregation.tsx) ───────────────────────────

function ReadinessRollupTab({
  suppliers,
  supplier,
  onNavigate,
}: {
  suppliers: SupplierResult[]
  supplier: SupplierResult
  onNavigate?: (id: string) => void
}) {
  const theme = useTheme()
  const [visible, setVisible] = useState<Record<string, boolean>>(() => Object.fromEntries(suppliers.map((s) => [s.id, true])))

  const radarData = useMemo(
    () =>
      DF_CODES.map((df) => {
        const meta = decisionFactors.find((d) => d.code === df)!
        const row: Record<string, number | string> = { df: meta.short }
        suppliers.forEach((s) => {
          const d = s.dfResults.find((x) => x.df === df)!
          row[s.id] = d.score === null ? 0 : Number((d.score * 100).toFixed(1))
        })
        return row
      }),
    [suppliers],
  )

  const supplierCount = suppliers.length
  const criticalCount = suppliers.filter((s) => s.criticalFlags.length > 0).length
  const avgReadiness = supplierCount ? suppliers.reduce((a, s) => a + s.readiness, 0) / supplierCount : 0

  const scoredWeightSum = supplier.dfResults.filter((d) => d.score !== null).reduce((a, d) => a + d.weight, 0)
  const weightedScoreSum = supplier.dfResults.filter((d) => d.score !== null).reduce((a, d) => a + (d.score ?? 0) * d.weight, 0)

  return (
    <Stack spacing={2}>
      <KpiRow>
        <KpiTile value={supplierCount} label="Suppliers evaluated" icon={<GroupsRoundedIcon fontSize="small" />} />
        <KpiTile
          value={criticalCount}
          label="With critical flags"
          tone={criticalCount > 0 ? 'critical' : 'pass'}
          icon={<ReportProblemRoundedIcon fontSize="small" />}
        />
        <KpiTile
          value={`${(avgReadiness * 100).toFixed(1)}%`}
          label="Average readiness"
          tone="info"
          icon={<TrendingUpRoundedIcon fontSize="small" />}
        />
      </KpiRow>

      <SectionCard title="Decision-factor readiness profile" hint="Score % per decision factor, across all evaluated suppliers.">
        <Box sx={{ height: 420 }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke={theme.palette.divider} />
              <PolarAngleAxis dataKey="df" tick={{ fill: theme.palette.text.secondary, fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: theme.palette.text.disabled, fontSize: 10 }} />
              {suppliers.filter((s) => visible[s.id]).map((s) => (
                <Radar
                  key={s.id}
                  name={s.id}
                  dataKey={s.id}
                  stroke={SUPPLIER_COLORS[s.id]}
                  fill={SUPPLIER_COLORS[s.id]}
                  fillOpacity={0.12}
                  strokeWidth={2}
                />
              ))}
              <RechartsTooltip />
              <Legend onClick={(e) => setVisible((v) => ({ ...v, [String(e.value)]: !v[String(e.value)] }))} />
            </RadarChart>
          </ResponsiveContainer>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center' }}>
          Click a legend entry to toggle a supplier.
        </Typography>
      </SectionCard>

      <SectionCard
        title={`${supplier.id} · ${supplier.name} — decision-factor roll-up`}
        hint="Metric → decision factor → readiness. Weighted contribution feeds the overall readiness score below."
        action={
          supplier.gateCapped ? (
            <StatusBadge tone="watch" label="Mandatory-floor gate fired — label capped" />
          ) : undefined
        }
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Decision factor</TableCell>
                <TableCell>Weight</TableCell>
                <TableCell>Scored factors</TableCell>
                <TableCell>DF score</TableCell>
                <TableCell>Weighted contribution</TableCell>
                <TableCell>Gate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {supplier.dfResults.map((d) => (
                <TableRow key={d.df} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{d.df} · {d.name}</Typography>
                  </TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{d.weight}</Typography></TableCell>
                  <TableCell><Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{d.scoredCount}</Typography></TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{d.score === null ? '—' : (d.score * 100).toFixed(1) + '%'}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{d.score === null ? '—' : (d.score * d.weight).toFixed(1)}</Typography>
                  </TableCell>
                  <TableCell>
                    {d.hasMandatory ? (
                      d.belowFloor ? (
                        <StatusBadge tone="critical" label="Below floor" icon={false} size="small" />
                      ) : (
                        <StatusBadge tone="pass" label="OK" icon={false} size="small" />
                      )
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow sx={{ bgcolor: '#FAFBFC' }}>
                <TableCell>
                  <Typography variant="caption" sx={{ fontWeight: 700 }}>
                    Readiness = Σ(DF score × weight) / Σ(weight of scored DFs)
                  </Typography>
                </TableCell>
                <TableCell><Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{scoredWeightSum}</Typography></TableCell>
                <TableCell colSpan={2}>
                  <Typography variant="body2" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{weightedScoreSum.toFixed(1)} / weight</Typography>
                </TableCell>
                <TableCell><Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{(supplier.readiness * 100).toFixed(1)}%</Typography></TableCell>
                <TableCell><ReadinessBadge label={supplier.label} /></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </Box>

        <Button size="small" sx={{ mt: 2 }} onClick={() => onNavigate?.('comparison')}>
          Go to Supplier Comparison →
        </Button>
      </SectionCard>
    </Stack>
  )
}
