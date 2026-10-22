import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppProviders } from '@/app/providers'
import '@/styles/globals.css'

const container = document.getElementById('root')
if (!container) {
  throw new Error('The #root element is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <AppProviders />
  </StrictMode>,
)
