import { useState } from 'react'
import Grid from '@mui/material/Grid'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded'
import { useStore } from '../../state/store'
import { SectionCard } from '../../components/SectionCard'
import { KpiRow, KpiTile } from '../../components/KpiTile'
import { SupplierAvatar } from '../../components/SupplierAvatar'
import { AppDrawer } from '../../components/AppDrawer'
import { EmptyState } from '../../components/States'
import { getDocumentsForSupplier } from '../../engine/aiExtraction'
import { buildChecklist, whyItMatters, expectedEvidenceExamples } from '../../engine/evidence'
import suppliers from '../../data/suppliers.json'

export default function DocumentsStage() {
  const { result } = useStore()
  const [checklistOpen, setChecklistOpen] = useState(false)
  const groups = buildChecklist(result.applicability)
  const totalChecklist = groups.reduce((n, g) => n + g.items.length, 0)

  const withPacks = suppliers.filter((s) => getDocumentsForSupplier(s.id).length > 0)
  const withoutPacks = suppliers.filter((s) => getDocumentsForSupplier(s.id).length === 0)
  const totalDocs = withPacks.reduce((n, s) => n + getDocumentsForSupplier(s.id).length, 0)

  return (
    <Stack spacing={2}>
      <KpiRow>
        <KpiTile value={withPacks.length} label="Suppliers with documents" tone="pass" icon={<DescriptionRoundedIcon fontSize="small" />} />
        <KpiTile value={totalDocs} label="Documents submitted" />
        <KpiTile value={totalChecklist} label="Evidence items in scope" />
      </KpiRow>

      <SectionCard
        title="Submitted document packs"
        hint="Simulated intake — one card per supplier with a document pack ready for extraction."
        action={
          <Button size="small" startIcon={<ChecklistRoundedIcon />} onClick={() => setChecklistOpen(true)}>
            View expected evidence checklist
          </Button>
        }
      >
        <Grid container spacing={2}>
          {withPacks.map((s) => {
            const docs = getDocumentsForSupplier(s.id)
            return (
              <Grid key={s.id} size={{ xs: 12, md: 6 }}>
                <Box sx={{ border: '1px solid #E4E7EC', borderRadius: 3, p: 2 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
                    <SupplierAvatar id={s.id} name={s.name} />
                    <Box>
                      <Typography variant="subtitle2" fontWeight={700}>
                        {s.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {s.id} · {docs.length} document{docs.length === 1 ? '' : 's'}
                      </Typography>
                    </Box>
                  </Stack>
                  <Stack spacing={0.75}>
                    {docs.map((doc) => (
                      <Stack key={doc.documentId} direction="row" spacing={1} alignItems="center" sx={{ fontSize: 13 }}>
                        <DescriptionRoundedIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>
                            {doc.documentName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {doc.pageCount}p · {doc.fileSizeKB}KB · {doc.documentType}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={doc.textExtractable ? 'Text PDF' : 'OCR needed'}
                          color={doc.textExtractable ? 'success' : 'warning'}
                          variant="outlined"
                        />
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              </Grid>
            )
          })}
        </Grid>
      </SectionCard>

      {withoutPacks.length > 0 && (
        <SectionCard title="No document pack submitted" dense>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 1 }}>
            {withoutPacks.map((s) => (
              <Chip key={s.id} avatar={<SupplierAvatar id={s.id} name={s.name} size={22} />} label={s.name} variant="outlined" />
            ))}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Still evaluated from structured Supplier Data — they have no document pack to extract from in this sample.
          </Typography>
        </SectionCard>
      )}

      {withPacks.length === 0 && <EmptyState title="No supplier documents yet" description="Once a supplier submits a document pack, it will appear here for extraction." />}

      <AppDrawer open={checklistOpen} onClose={() => setChecklistOpen(false)} title="Expected evidence checklist" subtitle={`${totalChecklist} items in scope — Mandatory + Conditional Active factors`}>
        <Stack spacing={2.5}>
          {groups.map((g) => (
            <Box key={g.sourceType}>
              <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>
                {g.sourceType}
              </Typography>
              <Stack spacing={1.25}>
                {g.items.map((it) => (
                  <Box key={it.code} sx={{ pb: 1.25, borderBottom: '1px dashed #E4E7EC' }}>
                    <Typography variant="body2" fontWeight={600}>
                      {it.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {whyItMatters(it.field)}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap', gap: 0.5 }}>
                      {expectedEvidenceExamples(it.field).map((e, i) => (
                        <Chip key={i} size="small" label={e} variant="outlined" />
                      ))}
                    </Stack>
                  </Box>
                ))}
              </Stack>
            </Box>
          ))}
        </Stack>
      </AppDrawer>
    </Stack>
  )
}
