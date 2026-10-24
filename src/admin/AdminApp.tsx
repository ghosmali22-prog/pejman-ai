import '@fontsource-variable/vazirmatn'
import { useCallback, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { isAdminEmail } from '../lib/supabase'
import { AdminLayout } from './components/AdminLayout'
import { ConfirmProvider, Spinner } from './components/ui'
import * as api from './lib/api'
import { AdminContext } from './lib/context'
import { I18nProvider, useI18n } from './lib/i18n'
import { CategoriesPage } from './pages/CategoriesPage'
import { DashboardPage } from './pages/DashboardPage'
import { LoginPage } from './pages/LoginPage'
import { MessagesPage } from './pages/MessagesPage'
import { PromptEditorPage } from './pages/PromptEditorPage'
import { PromptsPage } from './pages/PromptsPage'
import { SettingsPage } from './pages/SettingsPage'
import { SubscribersPage } from './pages/SubscribersPage'

/** /admin — lazy-loaded, so visitors of the public site never download it. */
export default function AdminApp() {
  return (
    <I18nProvider>
      <Shell />
    </I18nProvider>
  )
}

function Shell() {
  const { dir, lang } = useI18n()
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    document.title = 'Admin · PEJMAN AI'
    api.auth.email().then(setEmail)
    return api.auth.onChange(setEmail)
  }, [])

  const refreshUnread = useCallback(() => {
    api.messages
      .unreadCount()
      .then(setUnread)
      .catch(() => {})
  }, [])

  const allowed = isAdminEmail(email)
  useEffect(() => {
    if (allowed) refreshUnread()
  }, [allowed, refreshUnread])

  return (
    <div
      dir={dir}
      lang={lang}
      className="min-h-svh bg-ink text-paper"
      style={{ fontFamily: lang === 'fa' ? "'Vazirmatn Variable', 'Geist Variable', sans-serif" : undefined }}
    >
      <ConfirmProvider>
        {email === undefined ? (
          <Spinner />
        ) : !allowed ? (
          <LoginPage email={email} />
        ) : (
          <AdminContext.Provider value={{ email: email!, unread, refreshUnread }}>
            <Routes>
              <Route element={<AdminLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="prompts" element={<PromptsPage />} />
                <Route path="prompts/new" element={<PromptEditorPage />} />
                <Route path="prompts/:id" element={<PromptEditorPage />} />
                <Route path="categories" element={<CategoriesPage />} />
                <Route path="messages" element={<MessagesPage />} />
                <Route path="subscribers" element={<SubscribersPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<DashboardPage />} />
              </Route>
            </Routes>
          </AdminContext.Provider>
        )}
      </ConfirmProvider>
    </div>
  )
}
