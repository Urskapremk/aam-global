'use server'

import { checkPassword, signInAdmin, signOutAdmin } from '@/lib/admin-auth'
import { redirect } from 'next/navigation'

export async function loginAction(_prev: unknown, formData: FormData) {
  const password = String(formData.get('password') ?? '')
  if (!checkPassword(password)) {
    return { error: 'Incorrect password.' }
  }
  await signInAdmin()
  redirect('/admin')
}

export async function logoutAction() {
  await signOutAdmin()
  redirect('/admin/login')
}
