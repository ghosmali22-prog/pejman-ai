import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { SiteLayout } from './components/layout/SiteLayout'
import { HomePage } from './pages/HomePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PromptsPage } from './pages/PromptsPage'
import { MotionProvider } from './providers/MotionProvider'
import { SiteDataProvider } from './providers/SiteDataProvider'
import { ToastProvider } from './providers/ToastProvider'

// The admin panel is its own bundle: visitors of the public site never download it.
const AdminApp = lazy(() => import('./admin/AdminApp'))

const basename = import.meta.env.BASE_URL.replace(/\/$/, '')

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <MotionProvider>
        <ToastProvider>
          <Routes>
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<div className="min-h-svh bg-ink" />}>
                  <AdminApp />
                </Suspense>
              }
            />
            <Route
              element={
                <SiteDataProvider>
                  <SiteLayout />
                </SiteDataProvider>
              }
            >
              <Route path="/" element={<HomePage />} />
              {/* The library stays mounted while a prompt overlay is open at /p/:slug */}
              <Route element={<PromptsPage />}>
                <Route path="prompts" element={null} />
                <Route path="p/:slug" element={null} />
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </ToastProvider>
      </MotionProvider>
    </BrowserRouter>
  )
}
