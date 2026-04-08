import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LocaleProvider } from './i18n/LocaleProvider.tsx'
import { AreaUnitProvider } from './context/AreaUnitContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LocaleProvider>
      <AreaUnitProvider>
        <App />
      </AreaUnitProvider>
    </LocaleProvider>
  </StrictMode>,
)
