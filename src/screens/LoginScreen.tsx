import { useState } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Divider from '@mui/material/Divider'
import Container from '@mui/material/Container'
import FactoryRoundedIcon from '@mui/icons-material/FactoryRounded'
import { useStore } from '../state/store'

// Mock authentication gate — no backend. "Continue as Demo Manufacturer" is the
// fast path; the form fields are cosmetic and accept anything.
export default function LoginScreen() {
  const { login } = useStore()
  const [name, setName] = useState('')

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center' }}>
      <Container maxWidth="xs">
        <Stack alignItems="center" spacing={1} sx={{ mb: 4 }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 3,
              bgcolor: 'primary.main',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <FactoryRoundedIcon fontSize="medium" />
          </Box>
          <Typography variant="h6" fontWeight={800}>
            Supplier Evaluation Engine
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Sign in to evaluate and compare suppliers for your manufacturing sourcing decisions.
          </Typography>
        </Stack>

        <Stack
          component="form"
          spacing={2}
          onSubmit={(e) => {
            e.preventDefault()
            login(name.trim() || 'Demo Manufacturer')
          }}
          sx={{ bgcolor: '#fff', border: '1px solid #E4E7EC', borderRadius: 3, p: 3 }}
        >
          <TextField
            label="Work email"
            placeholder="you@manufacturer.com"
            size="small"
            value={name}
            onChange={(e) => setName(e.target.value)}
            fullWidth
          />
          <TextField label="Password" type="password" placeholder="••••••••" size="small" fullWidth />
          <Button type="submit" variant="contained" size="large" fullWidth>
            Sign in
          </Button>
          <Divider>
            <Typography variant="caption" color="text.secondary">
              OR
            </Typography>
          </Divider>
          <Button variant="outlined" size="large" fullWidth onClick={() => login('Demo Manufacturer')}>
            Continue as Demo Manufacturer
          </Button>
        </Stack>
      </Container>
    </Box>
  )
}
