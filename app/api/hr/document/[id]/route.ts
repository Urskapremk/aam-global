import { get } from '@vercel/blob'

import { pool } from '@/lib/db'
import { isAdmin } from '@/lib/admin-auth'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 })
  const { id } = await params

  const { rows } = await pool.query(
    `SELECT url, pathname, access, "contentType" FROM hr_documents WHERE id = $1`,
    [id],
  )
  const doc = rows[0]
  if (!doc) return new Response('Not found', { status: 404 })

  const headers = {
    'Content-Type': String(doc.contentType || 'application/octet-stream'),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  }

  if (doc.access === 'private') {
    const result = await get(String(doc.pathname), { access: 'private' })
    if (!result || result.statusCode !== 200) return new Response('Not found', { status: 404 })
    return new Response(result.stream, { headers })
  }

  const res = await fetch(String(doc.url))
  if (!res.ok || !res.body) return new Response('Not found', { status: 404 })
  return new Response(res.body, { headers })
}
