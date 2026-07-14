import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Grid from '@mui/material/Grid'
import Chip from '@mui/material/Chip'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Tooltip from '@mui/material/Tooltip'
import Accordion from '@mui/material/Accordion'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import SearchRoundedIcon from '@mui/icons-material/SearchRounded'
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded'
import leafFactors from '../data/leafFactors.json'
import metrics from '../data/metrics.json'
import decisionFactors from '../data/decisionFactors.json'
import { SectionCard } from '../components/SectionCard'
import { EmptyState } from '../components/States'

interface MetricDef {
  type: string; unit: string; direction: string
  pass?: number; watch?: number; relativeTo?: string
  passSet?: string[]; watchSet?: string[]; failSet?: string[]
  bufferDays?: number; criticalFlagRule?: string; evidence: string; provisional: boolean
}
const defs = metrics as unknown as Record<string, MetricDef>

function thresholdText(d: MetricDef): string {
  if (d.type === 'date') return `Valid ≥ ${d.bufferDays ?? 30}-day buffer → Pass; within buffer → Watch; expired → Below / Critical`
  if (d.type === 'enum') return `Pass: ${d.passSet?.join(', ')} · Watch: ${d.watchSet?.join(', ') || '—'} · Below: ${d.failSet?.join(', ') || '—'}`
  const rel = d.relativeTo ? ` × ${d.relativeTo.replace(/_/g, ' ')}` : ''
  if (d.direction === 'gte') return `Pass ≥ ${d.pass}${rel} · Watch ≥ ${d.watch}${rel} · else Below`
  return `Pass ≤ ${d.pass}${rel} · Watch ≤ ${d.watch}${rel} · else Below`
}

function directionLabel(direction: string): string {
  if (direction === 'gte') return 'Higher better'
  if (direction === 'lte') return 'Lower better'
  return direction
}

export default function MetricDictionaryPage() {
  const [q, setQ] = useState('')
  const [dfFilter, setDfFilter] = useState<string>('all')

  const rows = useMemo(() => leafFactors.filter((lf) => {
    if (dfFilter !== 'all' && lf.df !== dfFilter) return false
    const hay = `${lf.code} ${lf.name} ${lf.canonicalField}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  }), [q, dfFilter])

  return (
    <Stack spacing={2}>
      <SectionCard dense>
        <Stack spacing={1.5}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search field, factor, or code…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            slotProps={{
              input: {
                startAdornment: <SearchRoundedIcon fontSize="small" sx={{ color: 'text.secondary', mr: 1 }} />,
              },
            }}
          />
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            <Chip
              label="All"
              size="small"
              clickable
              color={dfFilter === 'all' ? 'primary' : 'default'}
              variant={dfFilter === 'all' ? 'filled' : 'outlined'}
              onClick={() => setDfFilter('all')}
            />
            {decisionFactors.map((d) => (
              <Chip
                key={d.code}
                label={`${d.code} · ${d.short}`}
                size="small"
                clickable
                color={dfFilter === d.code ? 'primary' : 'default'}
                variant={dfFilter === d.code ? 'filled' : 'outlined'}
                onClick={() => setDfFilter(d.code)}
              />
            ))}
          </Stack>
        </Stack>
      </SectionCard>

      {rows.length === 0 ? (
        <SectionCard>
          <EmptyState
            title="No matching factors"
            description="Try a different search term, or clear the decision-factor filter."
          />
        </SectionCard>
      ) : (
        <Grid container spacing={2}>
          {rows.map((lf) => (
            <Grid key={lf.code} size={{ xs: 12, sm: 6, md: 4 }}>
              <FactorCard lf={lf} d={defs[lf.canonicalField]} />
            </Grid>
          ))}
        </Grid>
      )}
    </Stack>
  )
}

function FactorCard({ lf, d }: { lf: (typeof leafFactors)[number]; d: MetricDef }) {
  const df = decisionFactors.find((x) => x.code === lf.df)!
  const threshold = thresholdText(d)

  return (
    <Accordion
      disableGutters
      variant="outlined"
      sx={{ borderRadius: 3, height: '100%', '&:before': { display: 'none' } }}
    >
      <AccordionSummary expandIcon={<ExpandMoreRoundedIcon />} sx={{ alignItems: 'flex-start', py: 0.5 }}>
        <Stack spacing={1} sx={{ width: '100%', pr: 1 }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
            <Box>
              <Typography variant="subtitle2" fontWeight={700} sx={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>
                {lf.canonicalField}
              </Typography>
              <Typography variant="caption" color="text.secondary">{lf.name}</Typography>
            </Box>
            <Chip size="small" label={lf.code} variant="outlined" sx={{ fontFamily: 'monospace', flexShrink: 0 }} />
          </Stack>
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
            <Chip size="small" color="primary" variant="outlined" label={lf.df} />
            <Chip size="small" label={d.type} />
            <Chip size="small" label={directionLabel(d.direction)} />
            <Tooltip title={threshold}>
              <Chip
                size="small"
                label={threshold}
                sx={{ maxWidth: 200, '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' } }}
              />
            </Tooltip>
          </Stack>
        </Stack>
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Stack spacing={1.25}>
          <DetailRow label="Decision factor" value={`${lf.df} · ${df.name}`} />
          <DetailRow label="Evidence required" value={d.evidence} />
          <DetailRow label="Critical-flag rule" value={d.criticalFlagRule ?? 'None'} />
          <DetailRow label="Threshold basis" value={d.provisional ? 'Provisional — pending review' : 'Representative band (spec §4)'} />
        </Stack>
      </AccordionDetails>
    </Accordion>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.65rem', mb: 0.25 }}>
        {label}
      </Typography>
      <Typography variant="body2">{value}</Typography>
    </Box>
  )
}
