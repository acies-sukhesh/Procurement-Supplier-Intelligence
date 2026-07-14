import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import MenuItem from '@mui/material/MenuItem'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Button from '@mui/material/Button'
import Slider from '@mui/material/Slider'
import Chip from '@mui/material/Chip'
import { useStore, MEDIUM_CRITICALITY_CONTEXT } from '../../state/store'
import { getStrategy, getWeights, DF_CODES } from '../../engine/evaluate'
import { SectionCard } from '../../components/SectionCard'
import { KpiRow, KpiTile } from '../../components/KpiTile'
import decisionFactors from '../../data/decisionFactors.json'
import strategies from '../../data/strategies.json'
import type { DFCode, RequestContext } from '../../engine/types'

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

const STAT_TILES: Array<{ label: string; status: string; tone: 'info' | 'locked' | 'watch' }> = [
  { label: 'Mandatory', status: 'Mandatory', tone: 'info' },
  { label: 'Optional', status: 'Optional', tone: 'locked' },
  { label: 'Conditional', status: 'Conditional Active', tone: 'watch' },
  { label: 'Not Applicable', status: 'Not Applicable', tone: 'locked' },
]

export default function ContextTab() {
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
    <Stack spacing={2}>
      <KpiRow>
        {STAT_TILES.map((t) => (
          <KpiTile key={t.status} value={counts[t.status] ?? 0} label={t.label} tone={t.tone} />
        ))}
      </KpiRow>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Component attributes" hint="Set by your Select Component choice — fine-tune here.">
            <Stack spacing={2}>
              {SELECTS.map((s) => (
                <TextField
                  key={s.key}
                  select
                  size="small"
                  label={s.label}
                  value={String(context[s.key])}
                  onChange={(e) => setContext({ [s.key]: e.target.value } as Partial<RequestContext>)}
                  fullWidth
                >
                  {s.options.map((o) => (
                    <MenuItem key={o} value={o}>{o}</MenuItem>
                  ))}
                </TextField>
              ))}
              <TextField
                type="number"
                size="small"
                label="Monthly demand (units/mo)"
                value={context.monthly_demand}
                onChange={(e) => setContext({ monthly_demand: Number(e.target.value) })}
                fullWidth
              />
              <TextField
                type="date"
                size="small"
                label="Evaluation date"
                value={context.eval_date}
                onChange={(e) => setContext({ eval_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
          </SectionCard>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <SectionCard title="Policy flags" hint="Yes / No sourcing-context toggles that drive applicability rules.">
            <Stack spacing={1.25}>
              {TOGGLES.map((t) => (
                <Stack key={t.key} direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="body2">{t.label}</Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    value={context[t.key]}
                    onChange={(_, v) => v && setContext({ [t.key]: v } as Partial<RequestContext>)}
                  >
                    <ToggleButton value="Yes" sx={{ px: 1.5, py: 0.25 }}>Yes</ToggleButton>
                    <ToggleButton value="No" sx={{ px: 1.5, py: 0.25 }}>No</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              ))}
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>

      <SectionCard
        title="Sourcing strategy & decision-factor weights"
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => setContext(MEDIUM_CRITICALITY_CONTEXT)}>Load Medium-criticality preset</Button>
            <Button size="small" onClick={reset}>Reset to reference</Button>
          </Stack>
        }
      >
        <ToggleButtonGroup
          exclusive
          size="small"
          value={context.sourcing_strategy}
          onChange={(_, v) => v && setContext({ sourcing_strategy: v })}
          sx={{ mb: 2, flexWrap: 'wrap' }}
        >
          {[...strategies, { id: 'Custom', name: 'Custom' }].map((s) => (
            <ToggleButton key={s.id} value={s.id}>{s.name}</ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
          <Typography variant="subtitle2" fontWeight={700}>Decision factor weights</Typography>
          {isCustom && <Chip size="small" label={`Σ ${customSum} / 100`} color={customSum === 100 ? 'success' : 'error'} variant="outlined" />}
        </Stack>
        <Grid container spacing={3}>
          {DF_CODES.map((df) => {
            const meta = decisionFactors.find((d) => d.code === df)!
            const val = weights[df]
            return (
              <Grid key={df} size={{ xs: 12, sm: 6 }}>
                <Stack direction="row" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">{df} · {meta.name}</Typography>
                  <Typography variant="caption" fontWeight={700}>{val}</Typography>
                </Stack>
                {isCustom ? (
                  <Slider
                    size="small"
                    min={0}
                    max={40}
                    value={context.customWeights?.[df] ?? 0}
                    onChange={(_, v) => setWeight(df as DFCode, v as number)}
                  />
                ) : (
                  <Box sx={{ height: 6, bgcolor: '#E4E7EC', borderRadius: 4, mt: 1.5, mb: 1 }}>
                    <Box sx={{ width: `${val * 2.5}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 4 }} />
                  </Box>
                )}
              </Grid>
            )
          })}
        </Grid>
      </SectionCard>
    </Stack>
  )
}
