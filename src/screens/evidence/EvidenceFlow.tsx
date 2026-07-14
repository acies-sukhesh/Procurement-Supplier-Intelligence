import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import LinearProgress from '@mui/material/LinearProgress'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded'
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded'
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded'
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded'
import { useStore } from '../../state/store'
import { getDocumentsForSupplier } from '../../engine/aiExtraction'
import { buildGapRegister } from '../../engine/evidence'
import suppliers from '../../data/suppliers.json'
import DocumentsStage from './DocumentsStage'
import ExtractionStage from './ExtractionStage'
import MappedFactorsStage from './MappedFactorsStage'
import MissingEvidenceStage from './MissingEvidenceStage'
import ReadyStage from './ReadyStage'

const STAGES = [
  { id: 'documents', label: 'Supplier Documents', icon: DescriptionRoundedIcon },
  { id: 'extraction', label: 'Extraction Status', icon: AutoAwesomeRoundedIcon },
  { id: 'mapped', label: 'Mapped Factors', icon: FactCheckRoundedIcon },
  { id: 'missing', label: 'Missing Evidence', icon: ReportProblemRoundedIcon },
  { id: 'ready', label: 'Ready for Evaluation', icon: TaskAltRoundedIcon },
] as const

type StageId = (typeof STAGES)[number]['id']

// "Load Supplier Data" (flow step 5) — redesigned as one visual pipeline instead of
// four separate text-heavy pages: Documents -> Extraction -> Mapped Factors ->
// Missing Evidence -> Ready. Each stage is a lightweight card view reusing the same
// store/engine calls the old screens used.
export default function EvidenceFlow({ onNavigate }: { onNavigate?: (id: string) => void }) {
  const [stage, setStage] = useState<StageId>('documents')
  const { aiExtractions, result } = useStore()

  const withPacks = suppliers.filter((s) => getDocumentsForSupplier(s.id).length > 0)
  const totalDocs = withPacks.reduce((n, s) => n + getDocumentsForSupplier(s.id).length, 0)
  const extractedCount = Object.keys(aiExtractions).length
  const totalClaims = useMemo(() => Object.values(aiExtractions).reduce((n, e) => n + e.claims.length, 0), [aiExtractions])
  const gapCount = useMemo(() => buildGapRegister(result).length, [result])

  const metricFor: Record<StageId, string> = {
    documents: `${totalDocs} documents`,
    extraction: `${extractedCount}/${withPacks.length} suppliers`,
    mapped: `${totalClaims} claims`,
    missing: `${gapCount} gaps`,
    ready: `${suppliers.length} suppliers`,
  }
  const stageIndex = STAGES.findIndex((s) => s.id === stage)

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        {STAGES.map((s, i) => {
          const Ico = s.icon
          const active = s.id === stage
          const done = i < stageIndex
          return (
            <Box
              key={s.id}
              onClick={() => setStage(s.id)}
              sx={{
                flex: '1 1 180px',
                cursor: 'pointer',
                border: '1px solid',
                borderColor: active ? 'primary.main' : '#E4E7EC',
                bgcolor: active ? 'rgba(22,87,201,0.04)' : '#fff',
                borderRadius: 3,
                p: 1.5,
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75 }}>
                <Box sx={{ color: done ? 'success.main' : active ? 'primary.main' : 'text.disabled', display: 'flex' }}>
                  <Ico fontSize="small" />
                </Box>
                <Typography variant="caption" fontWeight={700} color={active ? 'primary.main' : 'text.primary'}>
                  {i + 1}. {s.label}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                {metricFor[s.id]}
              </Typography>
              <LinearProgress
                variant="determinate"
                value={done ? 100 : active ? 50 : 0}
                color={done ? 'success' : 'primary'}
                sx={{ borderRadius: 4, height: 4 }}
              />
            </Box>
          )
        })}
      </Stack>

      {stage === 'documents' && <DocumentsStage />}
      {stage === 'extraction' && <ExtractionStage />}
      {stage === 'mapped' && <MappedFactorsStage onNavigate={onNavigate} />}
      {stage === 'missing' && <MissingEvidenceStage />}
      {stage === 'ready' && <ReadyStage onNavigate={onNavigate} />}
    </Stack>
  )
}
