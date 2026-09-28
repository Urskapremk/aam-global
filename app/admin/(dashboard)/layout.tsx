import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin-auth'
import { AdminShell } from '@/components/admin/admin-shell'
import { LanguageProvider } from '@/lib/i18n/context'
import { getLang } from '@/lib/i18n/server'

export const metadata = { title: { absolute: 'AAM Admin' } }

export default async function AdminDashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  if (!(await isAdmin())) redirect('/admin/login')
  const lang = await getLang()
  return (
    <LanguageProvider initialLang={lang}>
      <AdminShell>{children}</AdminShell>
    </LanguageProvider>
  )
}
