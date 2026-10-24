import { createContext, useContext } from 'react'

interface AdminCtx {
  email: string
  unread: number
  refreshUnread: () => void
}

export const AdminContext = createContext<AdminCtx>({ email: '', unread: 0, refreshUnread: () => {} })
export const useAdmin = () => useContext(AdminContext)
