import { useState } from 'react'
import Grid from '@mui/material/Grid'
import Card from '@mui/material/Card'
import CardActionArea from '@mui/material/CardActionArea'
import CardContent from '@mui/material/CardContent'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Button from '@mui/material/Button'
import PrecisionManufacturingRoundedIcon from '@mui/icons-material/PrecisionManufacturingRounded'
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded'
import { GateLayout } from '../components/GateLayout'
import { COMPONENT_PRESETS } from '../data/componentPresets'
import { useStore } from '../state/store'

export default function SelectComponent({ onContinue }: { onContinue: () => void }) {
  const { componentId, setComponentId } = useStore()
  const [selected, setSelected] = useState<string | null>(componentId)

  return (
    <GateLayout
      step={3}
      title="Which component are you sourcing?"
      subtitle="Sets sensible defaults for industry, criticality, and process — every field stays fully editable on the next screen."
      footer={
        <Button
          variant="contained"
          size="large"
          endIcon={<ArrowForwardRoundedIcon />}
          disabled={!selected}
          onClick={() => {
            if (selected) setComponentId(selected)
            onContinue()
          }}
        >
          Continue to Evaluation Policy
        </Button>
      }
    >
      <Grid container spacing={2}>
        {COMPONENT_PRESETS.map((c) => {
          const active = selected === c.id
          return (
            <Grid key={c.id} size={{ xs: 12, sm: 6 }}>
              <Card
                variant="outlined"
                sx={{ borderColor: active ? 'primary.main' : 'divider', borderWidth: active ? 2 : 1, height: '100%' }}
              >
                <CardActionArea onClick={() => setSelected(c.id)} sx={{ height: '100%', p: 0.5 }}>
                  <CardContent>
                    <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, color: active ? 'primary.main' : 'text.secondary' }}>
                      <PrecisionManufacturingRoundedIcon fontSize="small" />
                    </Stack>
                    <Typography variant="subtitle1" fontWeight={700}>
                      {c.name}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                      {c.description}
                    </Typography>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                      <Chip size="small" label={c.defaults.industry} />
                      <Chip size="small" label={c.defaults.part_criticality} color={c.defaults.part_criticality === 'Safety Critical' ? 'error' : 'default'} />
                      <Chip size="small" label={c.defaults.process_type} />
                    </Stack>
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
