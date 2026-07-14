import { useRef, useState } from 'react'
import Stack from '@mui/material/Stack'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Table from '@mui/material/Table'
import TableHead from '@mui/material/TableHead'
import TableBody from '@mui/material/TableBody'
import TableRow from '@mui/material/TableRow'
import TableCell from '@mui/material/TableCell'
import Snackbar from '@mui/material/Snackbar'
import DescriptionRoundedIcon from '@mui/icons-material/DescriptionRounded'
import { SectionCard } from '../../components/SectionCard'
import { StatusBadge } from '../../components/StatusBadge'
import ruleTemplates from '../../data/rule_templates.json'

interface FactorRule { code: string; df: string; name: string; field: string; recommendationType: string; threshold: string; dataSource: string }
interface HierarchyLevel { level: string; scope: string; example: string }
interface Template {
  id: string; name: string; version: string; status: string; uploadedBy: string; uploadedAt: string
  appliesTo: { industry: string; criticality: string; productionIntent: string }
  hierarchy: HierarchyLevel[]; factorRules: FactorRule[]
}
const data = ruleTemplates as unknown as { activeTemplateId: string; templates: Template[] }

const REC_TONE: Record<string, 'info' | 'watch' | 'locked'> = {
  'Required by Policy': 'info',
  'System Recommended': 'watch',
  'Not Applicable': 'locked',
}

export default function RuleTemplateTab() {
  const template = data.templates.find((t) => t.id === data.activeTemplateId) ?? data.templates[0]
  const [showRules, setShowRules] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const downloadSample = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample-rule-template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setToast(`Parsed "${f.name}" — ${template.factorRules.length} factor rules recognized. Mock only: the live engine is unchanged.`)
    e.target.value = ''
  }

  const recCount = (t: string) => template.factorRules.filter((r) => r.recommendationType === t).length

  return (
    <Stack spacing={2}>
      <SectionCard
        icon={<DescriptionRoundedIcon />}
        title="Active rule template"
        action={<StatusBadge tone="pass" label={template.status} icon={false} />}
      >
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ flexWrap: 'wrap', gap: 2, mb: 1.5 }}>
          <Box>
            <Typography variant="h6" fontWeight={700}>{template.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              Version {template.version} · uploaded by {template.uploadedBy} · {template.uploadedAt}
            </Typography>
            <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.75 }}>
              <Chip size="small" label={template.appliesTo.industry} />
              <Chip size="small" label={template.appliesTo.criticality} />
              <Chip size="small" label={`Production intent: ${template.appliesTo.productionIntent}`} />
            </Stack>
          </Box>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button size="small" onClick={downloadSample}>Download sample</Button>
            <Button size="small" onClick={() => fileRef.current?.click()}>Upload template</Button>
            <Button size="small" variant={showRules ? 'contained' : 'outlined'} onClick={() => setShowRules((v) => !v)}>
              {showRules ? 'Hide active rules' : 'View active rules'}
            </Button>
            <input ref={fileRef} type="file" accept=".json,.xlsx,.csv" style={{ display: 'none' }} onChange={onUpload} />
          </Stack>
        </Stack>
        <Stack direction="row" spacing={3}>
          <Typography variant="caption" color="text.secondary"><b>{recCount('Required by Policy')}</b> required by policy</Typography>
          <Typography variant="caption" color="text.secondary"><b>{recCount('System Recommended')}</b> system recommended</Typography>
          <Typography variant="caption" color="text.secondary"><b>{recCount('Not Applicable')}</b> not applicable</Typography>
        </Stack>
      </SectionCard>

      <SectionCard title="Rule hierarchy" hint="Most general → most specific">
        <Stack spacing={1.5}>
          {template.hierarchy.map((h, i) => (
            <Stack key={h.level} direction="row" spacing={1.5} sx={{ pl: i * 2, borderLeft: '2px solid', borderColor: 'primary.main' }}>
              <Box sx={{ pl: 1.5 }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2" fontWeight={700}>{h.level}</Typography>
                  <Chip size="small" label={h.scope} />
                </Stack>
                <Typography variant="caption" color="text.secondary">{h.example}</Typography>
              </Box>
            </Stack>
          ))}
        </Stack>
      </SectionCard>

      {showRules && (
        <SectionCard title={`Active rules — ${template.factorRules.length} factors`}>
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Code</TableCell><TableCell>Factor</TableCell><TableCell>DF</TableCell>
                  <TableCell>Recommendation</TableCell><TableCell>Threshold</TableCell><TableCell>Data source</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {template.factorRules.map((r) => (
                  <TableRow key={r.code} hover>
                    <TableCell><Typography variant="caption">{r.code}</Typography></TableCell>
                    <TableCell><Typography variant="body2" fontWeight={600}>{r.name}</Typography></TableCell>
                    <TableCell><Typography variant="caption">{r.df}</Typography></TableCell>
                    <TableCell><StatusBadge tone={REC_TONE[r.recommendationType] ?? 'locked'} label={r.recommendationType} icon={false} /></TableCell>
                    <TableCell><Typography variant="caption">{r.threshold}</Typography></TableCell>
                    <TableCell><Typography variant="caption" color="text.secondary">{r.dataSource}</Typography></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </SectionCard>
      )}

      <Snackbar open={!!toast} autoHideDuration={3200} onClose={() => setToast(null)} message={toast} />
    </Stack>
  )
}
