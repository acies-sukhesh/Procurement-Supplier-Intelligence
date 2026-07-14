import { useMemo, useState } from 'react'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import LockRoundedIcon from '@mui/icons-material/LockRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import { useStore } from '../../state/store'
import { evaluate } from '../../engine/evaluate'
import decisionFactors from '../../data/decisionFactors.json'
import metrics from '../../data/metrics.json'
import factorImpacts from '../../data/factorImpacts.json'
import { SectionCard } from '../../components/SectionCard'
import { KpiRow, KpiTile } from '../../components/KpiTile'
import { StatusBadge, ApplicabilityBadge, ReadinessBadge } from '../../components/StatusBadge'
import { SupplierAvatar } from '../../components/SupplierAvatar'
import { AppDrawer } from '../../components/AppDrawer'
import type { DFCode, FactorApplicability, FactorImpact } from '../../engine/types'

const TOTAL_FACTORS = 43
const metricDefs = metrics as unknown as Record<string, { evidence?: string }>
const impactDefs = factorImpacts as unknown as Record<string, { riskBlindSpot?: string }>

const SELECTION_LABELS: Record<string, { label: string; tone: 'info' | 'watch' | 'locked' }> = {
  'policy-required': { label: 'Mandatory', tone: 'info' },
  'system-recommended': { label: 'System Recommended', tone: 'watch' },
  optional: { label: 'Optional', tone: 'locked' },
  'not-applicable': { label: 'Not Applicable', tone: 'locked' },
}

function computeFactorImpacts(
  result: ReturnType<typeof useStore>['result'],
  context: ReturnType<typeof useStore>['context'],
  pushedClaims: Record<string, Record<string, unknown>>,
  userSelections: Record<string, boolean>,
): FactorImpact[] {
  const inactive = result.applicability.filter((a) => !a.includedInEvaluation && a.selectionType !== 'not-applicable')
  return inactive.map((a) => {
    const simResult = evaluate(context, pushedClaims, { ...userSelections, [a.code]: true })
    const readinessDelta: Record<string, number> = {}
    result.suppliers.forEach((s) => {
      readinessDelta[s.id] = simResult.suppliers.find((x) => x.id === s.id)!.readiness - s.readiness
    })
    return {
      code: a.code, name: a.name, df: a.df, field: a.field, selectionType: a.selectionType,
      readinessDelta, confidenceDelta: 1 / TOTAL_FACTORS,
      riskBlindSpot: impactDefs[a.code]?.riskBlindSpot ?? `Unmonitored risk: ${a.name}`,
      missingDataSource: metricDefs[a.field]?.evidence ?? 'Source document not specified',
    }
  })
}

export default function ApplicabilityTab({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { result, context, pushedClaims, userSelections, setUserSelection, resetUserSelections, saveScenario } = useStore()
  const app = result.applicability
  const [selected, setSelected] = useState<FactorApplicability | null>(null)
  const [showImpact, setShowImpact] = useState(false)
  const [scenarioName, setScenarioName] = useState('')
  const [savedFlash, setSavedFlash] = useState(false)

  const activeCount = app.filter((a) => a.includedInEvaluation).length
  const applicableCount = app.filter((a) => a.selectionType !== 'not-applicable').length
  const inactiveNonNa = app.filter((a) => !a.includedInEvaluation && a.selectionType !== 'not-applicable').length

  const baseline = useMemo(() => evaluate(context, {}, {}), [context])

  const handleSaveScenario = () => {
    if (!scenarioName.trim()) return
    saveScenario(scenarioName.trim())
    setScenarioName('')
    setSavedFlash(true)
    setTimeout(() => setSavedFlash(false), 2000)
  }

  const impacts = useMemo(() => (showImpact ? computeFactorImpacts(result, context, pushedClaims, userSelections) : []), [showImpact, result, context, pushedClaims, userSelections])
  const sortedImpacts = useMemo(
    () => impacts.map((imp) => ({ imp, total: Object.values(imp.readinessDelta).reduce((a, b) => a + b, 0) })).sort((a, b) => Math.abs(b.total) - Math.abs(a.total)),
    [impacts],
  )

  return (
    <Stack spacing={2}>
      <KpiRow>
        <KpiTile value={app.filter((a) => a.selectionType === 'policy-required').length} label="Mandatory" tone="info" />
        <KpiTile value={app.filter((a) => a.selectionType === 'system-recommended').length} label="System Recommended" tone="watch" />
        <KpiTile value={app.filter((a) => a.selectionType === 'optional').length} label="Optional" />
        <KpiTile value={app.filter((a) => a.status === 'Not Applicable').length} label="Not Applicable" tone="locked" />
        <KpiTile value={`${activeCount}/${TOTAL_FACTORS}`} label="Active in evaluation" tone="pass" />
      </KpiRow>

      {inactiveNonNa > 0 && (
        <SectionCard dense>
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ flexWrap: 'wrap', gap: 1 }}>
            <StatusBadge tone="watch" label={`${inactiveNonNa} available factor${inactiveNonNa === 1 ? '' : 's'} not included`} icon={false} />
            <Button size="small" onClick={resetUserSelections}>Reset to defaults</Button>
          </Stack>
        </SectionCard>
      )}
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Name this scenario, e.g. Quality Focus"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSaveScenario()}
          />
          <Button variant="contained" onClick={handleSaveScenario} disabled={!scenarioName.trim() || savedFlash}>
            {savedFlash ? 'Saved ✓' : 'Save as Scenario'}
          </Button>
        </Stack>
      {decisionFactors.map((df) => {
        const rows = app.filter((a) => a.df === (df.code as DFCode))
        const dfActive = rows.filter((r) => r.includedInEvaluation).length
        return (
          <Accordion key={df.code} defaultExpanded disableGutters sx={{ border: '1px solid #E4E7EC', borderRadius: 3, '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
              <Stack direction="row" spacing={1.5} alignItems="center" sx={{ width: '100%', pr: 2 }}>
                <Typography variant="subtitle2" fontWeight={700}>{df.code} · {df.name}</Typography>
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.secondary">{dfActive}/{rows.length} active</Typography>
              </Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 0 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Factor</TableCell>
                    <TableCell>Policy status</TableCell>
                    <TableCell>Selection</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((r) => {
                    const isUpgraded = r.ruleStatus === 'Mandatory' && r.base !== 'Mandatory'
                    return (
                      <TableRow key={r.code} hover sx={{ cursor: 'pointer' }} onClick={() => setSelected(r)}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{r.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{r.code}</Typography>
                        </TableCell>
                        <TableCell>
                          <ApplicabilityBadge status={r.ruleStatus} />
                          {isUpgraded && <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>↑ from {r.base}</Typography>}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          {r.locked ? (
                            <StatusBadge tone="locked" label="Locked by policy" icon />
                          ) : (
                            <Stack direction="row" alignItems="center">
                              <Checkbox
                                size="small"
                                checked={r.includedInEvaluation}
                                onChange={(e) => setUserSelection(r.code, e.target.checked)}
                              />
                              <Typography variant="body2">{r.includedInEvaluation ? 'Included' : 'Excluded'}</Typography>
                            </Stack>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </AccordionDetails>
          </Accordion>
        )
      })}

      <SectionCard title="Live readiness preview" hint={`Evaluating ${activeCount} of ${applicableCount} applicable factors`}>
        <Stack spacing={1}>
          {result.suppliers.map((s) => {
            const base = baseline.suppliers.find((x) => x.id === s.id)!
            const dPts = (s.readiness - base.readiness) * 100
            return (
              <Stack key={s.id} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.75, borderBottom: '1px dashed #E4E7EC' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <SupplierAvatar id={s.id} name={s.name} size={24} />
                  <Typography variant="body2" fontWeight={600}>{s.name}</Typography>
                </Stack>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Typography variant="body2" fontWeight={700}>{(s.readiness * 100).toFixed(1)}%</Typography>
                  <ReadinessBadge label={s.label} />
                  <Typography variant="caption" color={dPts > 0.05 ? 'success.main' : dPts < -0.05 ? 'error.main' : 'text.secondary'} sx={{ minWidth: 70, textAlign: 'right' }}>
                    {dPts > 0.05 ? '▲' : dPts < -0.05 ? '▼' : '–'} {dPts >= 0 ? '+' : ''}{dPts.toFixed(1)} pts
                  </Typography>
                </Stack>
              </Stack>
            )
          })}
        </Stack>
        <Button size="small" sx={{ mt: 1 }} onClick={() => onNavigate?.('scenario')}>
          Go to Scenario Comparison to compare saved scenarios →
        </Button>
      </SectionCard>

      <Accordion expanded={showImpact} onChange={() => setShowImpact((v) => !v)} disableGutters sx={{ border: '1px solid #E4E7EC', borderRadius: 3, '&:before': { display: 'none' } }}>
        <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="subtitle2" fontWeight={700}>What-if impact analyzer</Typography>
            <Typography variant="caption" color="text.secondary">{inactiveNonNa} inactive factor{inactiveNonNa === 1 ? '' : 's'}</Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          {sortedImpacts.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
              All available factors are already included in the evaluation.
            </Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Factor</TableCell>
                    <TableCell>Readiness impact (Σ suppliers)</TableCell>
                    <TableCell>Risk blind spot</TableCell>
                    <TableCell>Missing data source</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedImpacts.map(({ imp, total }) => {
                    const totalPts = total * 100
                    return (
                      <TableRow key={imp.code} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>{imp.name}</Typography>
                          <Typography variant="caption" color="text.secondary">{imp.code} · {imp.df}</Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={700} color={totalPts > 0.05 ? 'success.main' : totalPts < -0.05 ? 'error.main' : 'text.secondary'}>
                            {totalPts > 0.05 ? '▲' : totalPts < -0.05 ? '▼' : '–'} {Math.abs(totalPts).toFixed(1)} pts
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ maxWidth: 240 }}><Typography variant="caption">{imp.riskBlindSpot}</Typography></TableCell>
                        <TableCell><Chip size="small" label={imp.missingDataSource} variant="outlined" /></TableCell>
                        <TableCell>
                          <Button size="small" variant="outlined" onClick={() => setUserSelection(imp.code, true)}>+ Include</Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {selected && (
        <AppDrawer open onClose={() => setSelected(null)} title={selected.name} subtitle={`${selected.code} · ${selected.df} · ${selected.field}`}>
          <TraceContent factor={selected} />
        </AppDrawer>
      )}
    </Stack>
  )
}

function TraceContent({ factor }: { factor: FactorApplicability }) {
  const selInfo = SELECTION_LABELS[factor.selectionType]
  return (
    <Stack spacing={2}>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">Base status</Typography>
        <ApplicabilityBadge status={factor.ruleStatus} />
      </Stack>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">Selection type</Typography>
        <StatusBadge tone={selInfo.tone} label={selInfo.label} icon={false} />
      </Stack>
      <Stack direction="row" justifyContent="space-between">
        <Typography variant="body2" color="text.secondary">Included in evaluation</Typography>
        <Typography variant="body2" fontWeight={700}>{factor.includedInEvaluation ? 'Yes' : 'No'}</Typography>
      </Stack>
      {factor.locked && (
        <Chip icon={<LockRoundedIcon />} label="Locked by policy — cannot be changed" size="small" sx={{ alignSelf: 'flex-start' }} />
      )}
      <Typography variant="subtitle2" fontWeight={700}>Reason trace</Typography>
      <Stack spacing={1.5}>
        {factor.reason.map((step, i) => (
          <Stack key={i} direction="row" spacing={1.5}>
            <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: '#E4E7EC', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {i + 1}
            </Box>
            <Box>
              <Typography variant="body2" fontWeight={600}>{step.rule}</Typography>
              <Typography variant="caption" color="text.secondary">{step.detail}</Typography>
            </Box>
          </Stack>
        ))}
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Rules fire in fixed precedence: Not Applicable → Mandatory → Conditional → Default, then Criticality and Strategy upgrades.
      </Typography>
    </Stack>
  )
}
