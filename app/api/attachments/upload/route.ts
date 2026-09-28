import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { isAdmin } from '@/lib/admin-auth'

/**
 * Client-upload token endpoint for email attachments.
 *
 * The browser uploads each file DIRECTLY to Vercel Blob (not through this
 * function), so we bypass both the 1 MB Server Action limit and Vercel's
 * ~4.5 MB serverless request-body limit. That is what makes multi-megabyte
 * phone photos actually attach. This route only mints a short-lived, admin-
 * gated upload token; the file bytes never pass through it.
 *
 * Blobs are stored public so Resend can fetch them via the attachment `path`
 * when the email is sent.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody

  try {
    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async () => {
        // Only a signed-in admin may request an upload token.
        if (!(await isAdmin())) throw new Error('Unauthorized')
        return {
          addRandomSuffix: true,
          maximumSizeInBytes: 40 * 1024 * 1024, // 40 MB per file
          // No content-type restriction: phone photos can be HEIC/HEIF/JPEG
          // and admins may also attach PDFs or documents.
        }
      },
      // No onUploadCompleted: the client already receives the blob URL from
      // upload(), and Vercel cannot reach a callback on localhost anyway.
    })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upload failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
