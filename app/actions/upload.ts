'use server'

import { put } from '@vercel/blob'
import { isAdmin } from '@/lib/admin-auth'

export async function uploadImage(formData: FormData) {
  if (!(await isAdmin())) throw new Error('Unauthorized')

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Ni izbrane datoteke.' }
  }
  if (!file.type.startsWith('image/')) {
    return { error: 'Datoteka mora biti slika.' }
  }

  const ext = file.name.split('.').pop() || 'jpg'
  const key = `aam/${crypto.randomUUID()}.${ext}`

  const blob = await put(key, file, {
    access: 'public',
    addRandomSuffix: false,
  })

  return { url: blob.url }
}
