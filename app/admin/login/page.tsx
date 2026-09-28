import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin-auth'
import { LoginForm } from '@/components/admin/login-form'

export const metadata = { title: { absolute: 'AAM Admin — Sign in' } }

export default async function AdminLoginPage() {
  if (await isAdmin()) redirect('/admin')
  return <LoginForm />
}
