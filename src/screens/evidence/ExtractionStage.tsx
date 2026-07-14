import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import LinearProgress from '@mui/material/LinearProgress'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import { useStore } from '../../state/store'
import { SectionCard } from '../../components/SectionCard'
import { KpiRow, KpiTile } from '../../components/KpiTile'
import { SupplierAvatar } from '../../components/SupplierAvatar'
import { StatusBadge } from '../../components/StatusBadge'
import { EmptyState } from '../../components/States'
import { getDocumentsForSupplier } from '../../engine/aiExtraction'
import suppliers from '../../data/suppliers.json'

export default function ExtractionStage() {
  const { aiExtractions, aiExtractionRunning, runAIExtraction } = useStore()
  const withPacks = suppliers.filter((s) => getDocumentsForSupplier(s.id).length > 0)
  const runExtractions = Object.values(aiExtractions)
  const claimsExtracted = runExtractions.reduce((n, e) => n + e.claims.length, 0)
  const contradictions = runExtractions.reduce((n, e) => n + e.contradictions.length, 0)
  const runAll = () => withPacks.forEach((s) => runAIExtraction(s.id))

  if (withPacks.length === 0) {
    return <EmptyState title="No documents to extract from" description="Suppliers need a submitted document pack before extraction can run." />
  }

  return (
    <Stack spacing={2}>
      <KpiRow>
        <KpiTile value={`${runExtractions.length}/${withPacks.length}`} label="Suppliers extracted" tone="pass" />
        <KpiTile value={claimsExtracted} label="Claims extracted" />
        <KpiTile value={contradictions} label="Contradictions found" tone={contradictions > 0 ? 'watch' : undefined} />
      </KpiRow>

      <SectionCard
        title="Run extraction"
        hint="Simulated AI extraction — classifies each document and extracts evidence claims. No scoring decisions are automated."
        action={
          <Button variant="contained" size="small" startIcon={<AutoAwesomeRoundedIcon />} onClick={runAll}>
            Run extraction — all packs
          </Button>
        }
      >
        <Grid container spacing={2}>
          {withPacks.map((s) => {
            const running = aiExtractionRunning[s.id] ?? false
            const extraction = aiExtractions[s.id]
            return (
              <Grid key={s.id} size={{ xs: 12, md: 6 }}>
                <Box sx={{ border: '1px solid #E4E7EC', borderRadius: 3, p: 2 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center">
                      <SupplierAvatar id={s.id} name={s.name} />
                      <Box>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {s.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {getDocumentsForSupplier(s.id).length} documents
                        </Typography>
                      </Box>
                    </Stack>
                    <Button size="small" variant={extraction ? 'outlined' : 'contained'} disabled={running} onClick={() => runAIExtraction(s.id)}>
                      {running ? 'Extracting…' : extraction ? 'Re-run' : 'Run extraction'}
                    </Button>
                  </Stack>

                  {running && (
                    <Box sx={{ py: 1 }}>
                      <LinearProgress />
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                        Classifying documents and extracting evidence claims…
                      </Typography>
                    </Box>
                  )}

                  {!running && extraction && (
                    <Stack spacing={1}>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
                        <StatusBadge tone="pass" label={`${extraction.claims.length} claims`} icon={false} />
                        {extraction.missingEvidence.length > 0 && (
                          <StatusBadge tone="critical" label={`${extraction.missingEvidence.length} missing`} icon={false} />
                        )}
                        {extraction.contradictions.length > 0 && (
                          <StatusBadge tone="watch" label={`${extraction.contradictions.length} contradictions`} icon={false} />
                        )}
                      </Stack>
                      {extraction.contradictions.slice(0, 2).map((c) => (
                        <Typography key={c.contradictionId} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                          ⚠ {c.description}
                        </Typography>
                      ))}
                    </Stack>
                  )}

                  {!running && !extraction && (
                    <Typography variant="caption" color="text.secondary">
                      Not yet extracted.
                    </Typography>
                  )}
                </Box>
              </Grid>
            )
          })}
        </Grid>
      </SectionCard>
    </Stack>
  )
}
