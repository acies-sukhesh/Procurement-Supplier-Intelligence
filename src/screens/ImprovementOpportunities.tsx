import { useMemo } from 'react'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Grid from '@mui/material/Grid'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Divider from '@mui/material/Divider'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded'
import FlagRoundedIcon from '@mui/icons-material/FlagRounded'
import AssignmentLateRoundedIcon from '@mui/icons-material/AssignmentLateRounded'
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded'
import { useStore } from '../state/store'
import { buildSupplierProjection } from '../engine/projection'
import { whyItMatters, buildGapRegister } from '../engine/evidence'
import { SectionCard } from '../components/SectionCard'
import { KpiRow, KpiTile } from '../components/KpiTile'
import { StatusBadge, ReadinessBadge } from '../components/StatusBadge'
import { SupplierAvatar } from '../components/SupplierAvatar'
import { EmptyState } from '../components/States'
import type { FactorValidation, SupplierResult } from '../engine/types'

// ---------------------------------------------------------------------------
// Reused verbatim from Comparison.tsx: the same short-list derivations that
// already drive the Supplier Comparison screen. No new heuristics here — this
// screen only re-presents them alongside the existing projection ladder.
// ---------------------------------------------------------------------------
function strengths(s: SupplierResult): FactorValidation[] {
  return s.factors.filter((f) => f.status === 'Pass').slice(0, 3)
}
function gaps(s: SupplierResult): FactorValidation[] {
  const order = ['Critical Flag', 'Missing', 'Below Threshold', 'Invalid', 'Watch']
  return [...s.factors]
    .filter((f) => order.includes(f.status))
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))
    .slice(0, 3)
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

function gapTone(status: string): 'critical' | 'watch' {
  return status === 'Critical Flag' || status === 'Missing' ? 'critical' : 'watch'
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`
const pts = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)} pts`

export default function ImprovementOpportunities() {
  const { result, context, pushedClaims } = useStore()

  const projections = useMemo(
    () => new Map(result.suppliers.map((s) => [s.id, buildSupplierProjection(context, pushedClaims, s)])),
    [result, context, pushedClaims],
  )

  const gapRegister = useMemo(() => buildGapRegister(result), [result])

  const kpis = useMemo(() => {
    const totalGaps = result.suppliers.reduce((n, s) => n + gaps(s).length, 0)
    const suppliersWithCritical = result.suppliers.filter((s) => s.criticalFlags.length > 0).length
    let uplift = 0
    for (const s of result.suppliers) {
      const proj = projections.get(s.id)
      if (!proj) continue
      const best = Math.max(proj.readinessAfterAllMissing, proj.readinessAfterAllCritical)
      uplift += Math.max(0, best - proj.readinessNow)
    }
    const avgUpliftPts = result.suppliers.length ? (uplift / result.suppliers.length) * 100 : 0
    return { totalGaps, suppliersWithCritical, avgUpliftPts, weakOrMissing: gapRegister.length }
  }, [result, projections, gapRegister])

  if (result.suppliers.length === 0) {
    return <EmptyState title="No suppliers to evaluate" description="Add supplier data to see improvement opportunities." />
  }

  return (
    <Stack spacing={2}>
      <KpiRow>
        <KpiTile value={kpis.totalGaps} label="Open gaps (top 3/supplier)" tone="watch" icon={<AssignmentLateRoundedIcon fontSize="small" />} />
        <KpiTile value={kpis.weakOrMissing} label="Weak / missing evidence rows" tone="watch" />
        <KpiTile value={kpis.suppliersWithCritical} label="Suppliers with critical flags" tone="critical" icon={<FlagRoundedIcon fontSize="small" />} />
        <KpiTile value={`+${kpis.avgUpliftPts.toFixed(1)} pts`} label="Avg. potential uplift if gaps closed" tone="pass" icon={<TrendingUpRoundedIcon fontSize="small" />} />
      </KpiRow>

      <Grid container spacing={2}>
        {result.suppliers.map((s) => {
          const proj = projections.get(s.id)
          const supplierGaps = gaps(s)
          const supplierStrengths = strengths(s)
          const actions = nextActions(s)

          return (
            <Grid key={s.id} size={{ xs: 12, md: 6 }}>
              <SectionCard sx={{ height: '100%' }}>
                <Stack spacing={2}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <SupplierAvatar id={s.id} name={s.name} size={32} />
                      <Box>
                        <Typography variant="subtitle1" fontWeight={700}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.id}</Typography>
                      </Box>
                    </Stack>
                    <Stack alignItems="flex-end" spacing={0.5}>
                      <Typography variant="h6" fontWeight={700}>{pct(s.readiness)}</Typography>
                      <ReadinessBadge label={s.label} />
                    </Stack>
                  </Stack>

                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>Strengths</Typography>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                      {supplierStrengths.length === 0 && <Typography variant="body2" color="text.secondary">—</Typography>}
                      {supplierStrengths.map((f) => (
                        <StatusBadge key={f.code} tone="pass" label={f.name} icon={false} size="small" />
                      ))}
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>Gaps</Typography>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
                      {supplierGaps.length === 0 && <Typography variant="body2" color="text.secondary">None</Typography>}
                      {supplierGaps.map((f) => (
                        <StatusBadge key={f.code} tone={gapTone(f.status)} label={`${f.name} · ${f.status}`} icon={false} size="small" />
                      ))}
                    </Stack>
                  </Box>

                  <Box>
                    <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '0.06em' }}>Next actions</Typography>
                    <Stack spacing={0.75} sx={{ mt: 0.5 }}>
                      {actions.map((a, i) => (
                        <Stack key={i} direction="row" spacing={1} alignItems="flex-start">
                          <Box sx={{ color: 'primary.main', display: 'flex', mt: '2px' }}>
                            <RadioButtonUncheckedRoundedIcon sx={{ fontSize: 16 }} />
                          </Box>
                          <Typography variant="body2">{a}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>

                  {proj && (proj.missing.length > 0 || proj.critical.length > 0) && (
                    <Accordion disableGutters sx={{ border: '1px solid #E4E7EC', borderRadius: 3, '&:before': { display: 'none' } }}>
                      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
                        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', pr: 1 }}>
                          <Typography variant="subtitle2" fontWeight={700}>Improvement path</Typography>
                          <Box sx={{ flex: 1 }} />
                          {proj.missing.length > 0 && (
                            <Typography variant="caption" color="text.secondary">
                              → {pct(proj.readinessAfterAllMissing)} if all filled
                            </Typography>
                          )}
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 0 }}>
                        <Stack spacing={2}>
                          {proj.missing.length > 0 && (
                            <Box>
                              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                                MISSING FACTORS — CUMULATIVE READINESS LADDER
                              </Typography>
                              <Stack spacing={1}>
                                {proj.missing.map((step) => (
                                  <Box key={step.code} sx={{ pb: 1, borderBottom: '1px dashed #E4E7EC' }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                      <Stack direction="row" spacing={0.75} alignItems="center">
                                        <CheckCircleOutlineRoundedIcon sx={{ fontSize: 15, color: 'text.disabled' }} />
                                        <Typography variant="body2" fontWeight={600}>{step.name}</Typography>
                                        <Chip size="small" variant="outlined" label={step.df} sx={{ height: 18, fontSize: 10 }} />
                                      </Stack>
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <Typography variant="caption" color="success.main" fontWeight={700}>{pts(step.delta)}</Typography>
                                        <Typography variant="caption" color="text.secondary">→ {pct(step.readinessAfter)}</Typography>
                                      </Stack>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, ml: 2.75 }}>
                                      {whyItMatters(supplierFieldFor(s, step.code))}
                                    </Typography>
                                  </Box>
                                ))}
                              </Stack>
                            </Box>
                          )}

                          {proj.critical.length > 0 && (
                            <Box>
                              {proj.missing.length > 0 && <Divider sx={{ mb: 1.5 }} />}
                              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                                CRITICAL FLAGS — RESOLUTION IMPACT
                              </Typography>
                              <Stack spacing={1}>
                                {proj.critical.map((c) => (
                                  <Box key={c.code} sx={{ pb: 1, borderBottom: '1px dashed #E4E7EC' }}>
                                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                                      <Stack direction="row" spacing={0.75} alignItems="center">
                                        <WarningAmberRoundedIcon sx={{ fontSize: 15, color: 'status.critical.main' }} />
                                        <Typography variant="body2" fontWeight={600}>{c.name}</Typography>
                                        <Chip size="small" variant="outlined" label={c.df} sx={{ height: 18, fontSize: 10 }} />
                                      </Stack>
                                      <Stack direction="row" spacing={1} alignItems="center">
                                        <ReadinessBadge label={c.labelAfter} />
                                        <Typography variant="caption" color="text.secondary">→ {pct(c.readinessAfter)}</Typography>
                                      </Stack>
                                    </Stack>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, ml: 2.75 }}>
                                      {whyItMatters(supplierFieldFor(s, c.code))}
                                    </Typography>
                                  </Box>
                                ))}
                              </Stack>
                            </Box>
                          )}
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  )}
                </Stack>
              </SectionCard>
            </Grid>
          )
        })}
      </Grid>

      <Typography variant="caption" color="text.secondary">
        Improvement paths are hypothetical projections re-run through the existing evaluation engine — display only,
        never persisted or applied automatically.
      </Typography>
    </Stack>
  )
}

// Looks up the canonical field for a factor code on a supplier so `whyItMatters`
// (which is keyed by field, not factor code) can render a one-line rationale.
function supplierFieldFor(s: SupplierResult, code: string): string {
  return s.factors.find((f) => f.code === code)?.field ?? ''
}
