'use server'

import { del, put } from '@vercel/blob'

import { pool } from '@/lib/db'
import { isAdmin } from '@/lib/admin-auth'
import { getHrStaff } from '@/app/actions/hr'

export type HrDocument = {
  id: string
  staffId: string
  kind: string
  name: string
  contentType: string
  createdAt: string
}

const KINDS = new Set(['cin', 'passport', 'cnaps', 'license', 'contract', 'other'])

async function guard() {
  if (!(await isAdmin())) throw new Error('Not authorised')
  // Creates hr_* tables (including hr_documents) on first use.
  await getHrStaff()
}

export async function getHrDocuments(staffId: string): Promise<HrDocument[]> {
  await guard()
  const { rows } = await pool.query(
    `SELECT id, "staffId", kind, name, "contentType", "createdAt"
       FROM hr_documents WHERE "staffId" = $1 ORDER BY "createdAt" DESC`,
    [staffId],
  )
  return rows.map((r) => ({
    id: String(r.id),
    staffId: String(r.staffId),
    kind: String(r.kind),
    name: String(r.name),
    contentType: String(r.contentType ?? ''),
    createdAt: new Date(r.createdAt as string).toISOString(),
  }))
}

export async function uploadHrDocument(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  await guard()
  const file = formData.get('file')
  const staffId = String(formData.get('staffId') ?? '')
  const kindRaw = String(formData.get('kind') ?? 'other')
  const kind = KINDS.has(kindRaw) ? kindRaw : 'other'
  if (!staffId) return { error: 'Missing staff.' }
  if (!(file instanceof File) || file.size === 0) return { error: 'Ni izbrane datoteke.' }
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    return { error: 'Datoteka mora biti slika ali PDF.' }
  }
  if (file.size > 10 * 1024 * 1024) return { error: 'Datoteka je prevelika (največ 10 MB).' }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const pathname = `aam/hr/${staffId}/${kind}-${crypto.randomUUID()}.${ext}`

  // Personal documents belong in private storage. Some stores only allow
  // public blobs, so fall back to an unguessable public path in that case;
  // the file is still only ever served through the admin-checked route.
  let url: string
  let access: 'private' | 'public' = 'private'
  try {
    const blob = await put(pathname, file, { access: 'private', contentType: file.type })
    url = blob.url
  } catch {
    try {
      access = 'public'
      const blob = await put(pathname, file, {
        access: 'public',
        addRandomSuffix: true,
        contentType: file.type,
      })
      url = blob.url
    } catch (err) {
      console.error('HR document upload failed:', err)
      return { error: 'Nalaganje v shrambo ni uspelo. Poskusite znova.' }
    }
  }

  await pool.query(
    `INSERT INTO hr_documents (id, "staffId", kind, name, url, pathname, access, "contentType")
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      staffId,
      kind,
      file.name.slice(0, 200),
      url,
      pathname,
      access,
      file.type,
    ],
  )
  return { ok: true }
}

export async function deleteHrDocument(id: string): Promise<{ ok: true }> {
  await guard()
  const { rows } = await pool.query(`DELETE FROM hr_documents WHERE id = $1 RETURNING url`, [id])
  if (rows[0]?.url) {
    try {
      await del(String(rows[0].url))
    } catch (err) {
      console.error('HR document blob delete failed:', err)
    }
  }
  return { ok: true }
}
