import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { SiteLayout } from './components/layout/SiteLayout'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { MotionProvider } from './providers/MotionProvider'
import { SiteDataProvider } from './providers/SiteDataProvider'
import { ToastProvider } from './providers/ToastProvider'

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <MotionProvider>
        <SiteDataProvider>
          <ToastProvider>
            <Routes>
              <Route element={<SiteLayout />}>
                {/* Home stays mounted while a prompt overlay is open at /p/:slug */}
                <Route path="/" element={<HomePage />}>
                  <Route path="p/:slug" element={null} />
                </Route>
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Routes>
          </ToastProvider>
        </SiteDataProvider>
      </MotionProvider>
    </BrowserRouter>
  )
}
