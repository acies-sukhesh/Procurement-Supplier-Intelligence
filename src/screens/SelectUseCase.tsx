import { useState } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded'
import GavelRoundedIcon from '@mui/icons-material/GavelRounded'
import AutorenewRoundedIcon from '@mui/icons-material/AutorenewRounded'
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { GateLayout } from '../components/GateLayout'
import { USE_CASES, type UseCaseDef } from '../data/useCases'
import { useStore } from '../state/store'

const ICONS: Record<UseCaseDef['icon'], typeof AddCircleRoundedIcon> = {
  add: AddCircleRoundedIcon,
  gavel: GavelRoundedIcon,
  refresh: AutorenewRoundedIcon,
  shield: ShieldRoundedIcon,
}

export default function SelectUseCase({ onContinue }: { onContinue: () => void }) {
  const { useCaseId, setUseCaseId, manufacturerName } = useStore()
  const [selected, setSelected] = useState<string | null>(useCaseId)

  return (
    <GateLayout
      step={2}
      title={`Welcome, ${manufacturerName ?? 'there'}. What are you evaluating suppliers for?`}
      subtitle="This frames the evaluation — it doesn't change scoring, only labels and context shown throughout."
      footer={
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForwardRoundedIcon />}
          disabled={!selected}
          onClick={() => {
            if (selected) setUseCaseId(selected)
            onContinue()
          }}
        >
          Continue
        </Button>
      }
    >
      <Grid container spacing={2}>
        {USE_CASES.map((uc) => {
          const Ico = ICONS[uc.icon]
          const active = selected === uc.id
          return (
            <Grid key={uc.id} size={{ xs: 12, sm: 6 }}>
              <Card
                variant="outlined"
                sx={{ borderColor: active ? 'primary.main' : 'divider', borderWidth: active ? 2 : 1, height: '100%' }}
              >
                <CardActionArea onClick={() => setSelected(uc.id)} sx={{ height: '100%', p: 0.5 }}>
                  <CardContent>
                    <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                      <Box sx={{ color: active ? 'primary.main' : 'text.secondary', mb: 1 }}>
                        <Ico fontSize="medium" />
                      </Box>
                      {uc.tag && <Chip size="small" label={uc.tag} color="primary" variant="outlined" />}
                    </Stack>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {uc.label}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {uc.description}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          )
        })}
      </Grid>
    </GateLayout>
  )
}
