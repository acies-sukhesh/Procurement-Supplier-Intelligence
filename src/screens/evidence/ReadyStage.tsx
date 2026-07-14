import { useMemo } from 'react'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import LinearProgress from '@mui/material/LinearProgress'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { useStore } from '../../state/store'
import { SectionCard } from '../../components/SectionCard'
import { SupplierAvatar } from '../../components/SupplierAvatar'
import { getDocumentsForSupplier } from '../../engine/aiExtraction'
import { buildGapRegister } from '../../engine/evidence'
import suppliers from '../../data/suppliers.json'

interface Check { label: string; done: boolean }

export default function ReadyStage({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const { aiExtractions, pushedClaims, result } = useStore()
  const gaps = useMemo(() => buildGapRegister(result), [result])

  return (
    <Stack spacing={2}>
      <SectionCard title="Readiness by supplier" hint="Intake completeness — not the evaluation score. Supplier Evaluation runs regardless, using whichever data is available.">
        <Grid container spacing={2}>
          {suppliers.map((s) => {
            const hasDocs = getDocumentsForSupplier(s.id).length > 0
            const extracted = !!aiExtractions[s.id]
            const claims = aiExtractions[s.id]?.claims ?? []
            const accepted = claims.filter((c) => c.reviewStatus === 'Accepted').length
            const pending = claims.filter((c) => c.reviewStatus === 'Pending').length
            const pushed = !!pushedClaims[s.id]
            const missingGaps = gaps.filter((g) => g.supplierId === s.id && g.gapState === 'Missing').length

            const checks: Check[] = [
              { label: hasDocs ? 'Documents submitted' : 'No document pack', done: hasDocs },
              { label: extracted ? 'Extraction complete' : 'Extraction not run', done: extracted },
              { label: pending === 0 && claims.length > 0 ? 'All claims reviewed' : `${pending} claims pending review`, done: pending === 0 && claims.length > 0 },
              { label: pushed ? 'Accepted claims pushed' : 'Not yet pushed to evaluation', done: pushed },
            ]
            const score = checks.filter((c) => c.done).length

            return (
              <Grid key={s.id} size={{ xs: 12, md: 6 }}>
                <Box sx={{ border: '1px solid #E4E7EC', borderRadius: 3, p: 2 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1 }}>
                    <SupplierAvatar id={s.id} name={s.name} />
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="subtitle2" fontWeight={700}>{s.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {accepted} accepted · {missingGaps} gaps missing
                      </Typography>
                    </Box>
                  </Stack>
                  <LinearProgress variant="determinate" value={(score / checks.length) * 100} sx={{ borderRadius: 4, height: 6, mb: 1.25 }} />
                  <Stack spacing={0.5}>
                    {checks.map((c) => (
                      <Stack key={c.label} direction="row" spacing={1} alignItems="center">
                        {c.done ? (
                          <CheckCircleRoundedIcon fontSize="small" color="success" />
                        ) : (
                          <RadioButtonUncheckedRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                        )}
                        <Typography variant="body2" color={c.done ? 'text.primary' : 'text.secondary'}>{c.label}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Grid>
            )
          })}
        </Grid>
      </SectionCard>

      <Stack direction="row" justifyContent="flex-end">
        <Button variant="contained" size="large" endIcon={<ArrowForwardRoundedIcon />} onClick={() => onNavigate?.('evaluation')}>
          Continue to Supplier Evaluation
        </Button>
      </Stack>
    </Stack>
  )
}
