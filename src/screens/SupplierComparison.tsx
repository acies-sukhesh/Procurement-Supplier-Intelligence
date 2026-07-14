import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, LabelList, Tooltip } from 'recharts'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Grid from '@mui/material/Grid'
import LinearProgress from '@mui/material/LinearProgress'
import Button from '@mui/material/Button'
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded'
import EmojiEventsRoundedIcon from '@mui/icons-material/EmojiEventsRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { useStore } from '../state/store'
import { buildSkipImpacts, type ImpactBand } from '../engine/projection'
import { whyItMatters } from '../engine/evidence'
import decisionFactors from '../data/decisionFactors.json'
import { SUPPLIER_COLORS } from '../theme'
import { SectionCard } from '../components/SectionCard'
import { KpiRow, KpiTile } from '../components/KpiTile'
import { StatusBadge, ReadinessBadge, type StatusTone } from '../components/StatusBadge'
import { SupplierAvatar } from '../components/SupplierAvatar'
import type { DFCode } from '../engine/types'

const dfShort = (df: DFCode) => decisionFactors.find((d) => d.code === df)?.short ?? df

// Severity ordering, most severe first — used to pick the worst band for a
// factor when aggregating its impact across all suppliers.
const BAND_ORDER: ImpactBand[] = ['Critical', 'High', 'Medium', 'Low', 'None']
const BAND_TONE: Record<ImpactBand, StatusTone> = {
  Critical: 'critical',
  High: 'critical',
  Medium: 'watch',
  Low: 'locked',
  None: 'locked',
}

export default function SupplierComparison({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { result, context, pushedClaims } = useStore()
  const ranked = [...result.suppliers].sort((a, b) => a.topsisRank - b.topsisRank)
  const chartData = ranked.map((s) => ({ id: s.id, name: s.name, readiness: Number((s.readiness * 100).toFixed(1)), color: SUPPLIER_COLORS[s.id] }))
  const bestFit = ranked.find((s) => s.criticalFlags.length === 0) ?? ranked[0]
  const criticalCount = result.suppliers.filter((s) => s.criticalFlags.length > 0).length

  // Portfolio sensitivity: which currently-active factors cost the most readiness
  // across all suppliers if skipped. Reuses the existing buildSkipImpacts.
  const sensitivityAll = useMemo(() => {
    const included = new Map(result.applicability.map((a) => [a.code, a.includedInEvaluation]))
    const agg = new Map<string, { name: string; df: DFCode; field: string; total: number; per: Record<string, number>; band: ImpactBand }>()
    for (const s of result.suppliers) {
      for (const imp of buildSkipImpacts(context, pushedClaims, s)) {
        if (!included.get(imp.code)) continue // only active/selected factors
        const e = agg.get(imp.code) ?? { name: imp.name, df: imp.df, field: imp.field, total: 0, per: {}, band: 'None' as ImpactBand }
        e.total += imp.delta // delta <= 0 (readiness drop)
        e.per[s.id] = imp.delta
        if (BAND_ORDER.indexOf(imp.band) < BAND_ORDER.indexOf(e.band)) e.band = imp.band
        agg.set(imp.code, e)
      }
    }
    return [...agg.entries()]
      .map(([code, v]) => ({ code, ...v }))
      .sort((a, b) => a.total - b.total) // most negative (largest drop) first
  }, [result, context, pushedClaims])
  const sensitivity = sensitivityAll.slice(0, 8)

  return (
    <Stack spacing={2}>
      <KpiRow>
        <KpiTile value={ranked.length} label="Suppliers compared" icon={<GroupsRoundedIcon fontSize="small" />} />
        <KpiTile
          value={bestFit.id}
          label={`Top-ranked · ${bestFit.name}`}
          icon={<EmojiEventsRoundedIcon fontSize="small" />}
          tone="pass"
        />
        <KpiTile
          value={criticalCount}
          label="Suppliers with critical flags"
          icon={<ReportProblemRoundedIcon fontSize="small" />}
          tone={criticalCount > 0 ? 'critical' : 'pass'}
        />
        <KpiTile
          value={sensitivityAll.length}
          label="Active factors with readiness risk"
          icon={<TrendingDownRoundedIcon fontSize="small" />}
          tone="watch"
        />
      </KpiRow>

      <SectionCard title="Comparative supplier readiness" hint="Readiness % — ordered by relative TOPSIS rank">
        <Box sx={{ height: 260 }}>
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
        </Box>
      </SectionCard>

      {/* Portfolio factor sensitivity — readiness at risk if skipped */}
      <SectionCard
        title="Factor sensitivity — readiness at risk if skipped"
        hint="Active factors ranked by total readiness drop across all suppliers"
      >
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Factor</TableCell>
                <TableCell>Decision factor</TableCell>
                <TableCell>Impact</TableCell>
                <TableCell>Total at risk</TableCell>
                <TableCell>Per-supplier drop</TableCell>
                <TableCell>Why it matters</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sensitivity.map((r) => (
                <TableRow key={r.code} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{r.code}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">{r.df} · {dfShort(r.df)}</Typography>
                  </TableCell>
                  <TableCell>
                    <StatusBadge label={r.band} tone={BAND_TONE[r.band]} icon={false} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontWeight={700} color="error.main">{(r.total * 100).toFixed(1)} pts</Typography>
                    <Typography variant="caption" color="text.secondary">across all suppliers</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                      {result.suppliers.map((s) => {
                        const d = (r.per[s.id] ?? 0) * 100
                        return (
                          <Stack key={s.id} direction="row" spacing={0.5} alignItems="center" title={s.name}>
                            <Box sx={{ width: 7, height: 7, borderRadius: 0.5, bgcolor: SUPPLIER_COLORS[s.id] }} />
                            <Typography variant="caption" color="text.secondary">{d.toFixed(1)}</Typography>
                          </Stack>
                        )
                      })}
                    </Stack>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 280 }}>
                    <Typography variant="caption" color="text.secondary">{whyItMatters(r.field)}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </SectionCard>

      {/* Per-supplier scorecards */}
      <Grid container spacing={2}>
        {ranked.map((s) => {
          const isBest = s.id === bestFit.id
          return (
            <Grid key={s.id} size={{ xs: 12, md: 6 }}>
              <SectionCard
                sx={isBest ? { border: '2px solid', borderColor: 'primary.main' } : undefined}
                action={<Typography variant="caption" color="text.secondary">TOPSIS score {s.topsisScore.toFixed(3)}</Typography>}
                title={
                  <Stack direction="row" spacing={1.25} alignItems="center">
                    <Box
                      sx={{
                        width: 24, height: 24, borderRadius: '50%', bgcolor: s.topsisRank === 1 ? 'primary.main' : 'action.selected',
                        color: s.topsisRank === 1 ? 'primary.contrastText' : 'text.secondary',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0,
                      }}
                    >
                      {s.topsisRank}
                    </Box>
                    <SupplierAvatar id={s.id} name={s.name} size={28} />
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.id}</Typography>
                    </Box>
                  </Stack>
                }
              >
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <ReadinessBadge label={s.label} />
                    {isBest && <StatusBadge label="Best-fit shortlist candidate" tone="pass" />}
                  </Stack>
                  <Typography variant="h5" fontWeight={700}>{(s.readiness * 100).toFixed(1)}%</Typography>
                </Stack>

                <Stack spacing={1}>
                  {s.dfResults.map((d) => {
                    const v = d.score ?? 0
                    return (
                      <Stack key={d.df} direction="row" spacing={1.25} alignItems="center">
                        <Typography variant="caption" color="text.secondary" sx={{ width: 72, flexShrink: 0 }}>{dfShort(d.df)}</Typography>
                        <LinearProgress
                          variant="determinate"
                          value={d.score === null ? 0 : v * 100}
                          sx={{
                            flex: 1, height: 6, borderRadius: 3, bgcolor: 'action.hover',
                            '& .MuiLinearProgress-bar': { bgcolor: SUPPLIER_COLORS[s.id], borderRadius: 3 },
                          }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ width: 34, textAlign: 'right', flexShrink: 0 }}>
                          {d.score === null ? 'NA' : `${(v * 100).toFixed(0)}%`}
                        </Typography>
                      </Stack>
                    )
                  })}
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Bar length = decision-factor score
                </Typography>
              </SectionCard>
            </Grid>
          )
        })}
      </Grid>

      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 560 }}>
          This is a comparative readiness recommendation and best-fit shortlist to support review — not a final approval, rejection, or automated decision.
        </Typography>
        <Button
          variant="contained"
          endIcon={<ArrowForwardRoundedIcon />}
          onClick={() => onNavigate?.('improvement')}
        >
          See improvement opportunities for these suppliers
        </Button>
      </Stack>
    </Stack>
  )
}
