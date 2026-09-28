'use client'

import { useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Send, Eye, X, Paperclip, Camera, FileText } from 'lucide-react'
import { upload } from '@vercel/blob/client'
import { sendMessage, previewEmail } from '@/app/actions/messages'
import { RichTextEditor } from '@/components/admin/rich-text-editor'
import { SaveContactPrompt } from '@/components/admin/save-contact-prompt'

export function ComposeForm({ configured }: { configured: boolean }) {
  const searchParams = useSearchParams()
  const [to, setTo] = useState(searchParams.get('to') ?? '')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [bodyText, setBodyText] = useState('')
  const [resetSignal, setResetSignal] = useState(0)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(
    null,
  )
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [contactPrompt, setContactPrompt] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  function addFiles(list: FileList | null) {
    if (!list || !list.length) return
    setAttachments((prev) => [...prev, ...Array.from(list)])
  }

  function removeAttachment(index: number) {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const totalAttachmentBytes = attachments.reduce((n, f) => n + f.size, 0)
  // Files upload straight to Blob (no server body limit); Resend caps a single
  // email at ~40 MB total, so that's the real ceiling.
  const attachmentsTooLarge = totalAttachmentBytes > 40 * 1024 * 1024

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  async function openPreview() {
    if (!bodyText.trim()) return
    setPreviewing(true)
    try {
      const html = await previewEmail({
        subject,
        body: bodyText,
        html: bodyHtml,
      })
      setPreviewHtml(html)
    } finally {
      setPreviewing(false)
    }
  }

  async function submit() {
    if (!to.trim() || !subject.trim() || !bodyText.trim()) return
    if (attachmentsTooLarge) {
      setFeedback({
        ok: false,
        text: 'Attachments are too large. Keep the total under about 40 MB.',
      })
      return
    }
    setSending(true)
    setFeedback(null)

    // Upload each attachment straight to Blob storage from the browser. This
    // bypasses the 1 MB Server Action limit and Vercel's ~4.5 MB request-body
    // limit, so multi-megabyte phone photos attach reliably. Resend then
    // downloads each file from its hosted URL.
    let uploaded: { filename: string; path: string; contentType?: string }[]
    try {
      uploaded = await Promise.all(
        attachments.map(async (file) => {
          const blob = await upload(file.name || 'attachment', file, {
            access: 'public',
            handleUploadUrl: '/api/attachments/upload',
            contentType: file.type || undefined,
          })
          return {
            filename: file.name || 'attachment',
            path: blob.url,
            contentType: file.type || undefined,
          }
        }),
      )
    } catch {
      setSending(false)
      setFeedback({
        ok: false,
        text: 'Could not upload one of the attachments. Please try again.',
      })
      return
    }

    const res = await sendMessage({
      to,
      subject,
      body: bodyText,
      html: bodyHtml,
      ...(uploaded.length ? { attachments: uploaded } : {}),
    })
    setSending(false)
    if (res.ok) {
      setFeedback({ ok: true, text: 'Email sent.' })
      setTo('')
      setSubject('')
      setAttachments([])
      setResetSignal((n) => n + 1)
      // Offer to save the recipient if it's not already in the address book
      // (only returned for single-recipient sends).
      if (!res.contactKnown && res.recipient) setContactPrompt(res.recipient)
    } else {
      setFeedback({ ok: false, text: res.error ?? 'Could not send.' })
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-1 font-serif text-2xl text-foreground">Send an email</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        Write and send an email to any address. A copy is kept in your inbox
        under &ldquo;Sent&rdquo;.
      </p>

      {!configured && (
        <p className="mb-5 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-muted-foreground">
          Sending is not active yet. Add your <code>RESEND_API_KEY</code> to
          start sending — messages you write now are saved but not delivered.
        </p>
      )}

      <div className="flex flex-col gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            To
          </label>
          <input
            type="text"
            className="input"
            placeholder="guest@example.com, another@example.com"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            Add several recipients separated by a comma, semicolon, or space.
          </p>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Subject
          </label>
          <input
            type="text"
            className="input"
            placeholder="Your enquiry with Anchored Adventures"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Message
          </label>
          <RichTextEditor
            placeholder="Write your message…"
            resetSignal={resetSignal}
            onChange={(html, text) => {
              setBodyHtml(html)
              setBodyText(text)
            }}
          />
        </div>

        {/* Attachments */}
        <div>
          <label className="mb-1.5 block text-sm font-medium text-foreground">
            Attachments
          </label>

          {/* Hidden inputs: one for any file, one that opens the phone camera. */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files)
              e.target.value = ''
            }}
          />

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Paperclip className="h-4 w-4" strokeWidth={1.5} />
              Attach file
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
            >
              <Camera className="h-4 w-4" strokeWidth={1.5} />
              Take photo
            </button>
          </div>

          {attachments.length > 0 && (
            <ul className="mt-3 flex flex-col gap-2">
              {attachments.map((file, i) => (
                <li
                  key={`${file.name}-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/40 px-3 py-2"
                >
                  {file.type.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={URL.createObjectURL(file) || '/placeholder.svg'}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                      <FileText className="h-5 w-5" strokeWidth={1.5} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">
                      {file.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {formatBytes(file.size)}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(i)}
                    aria-label={`Remove ${file.name}`}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <p
            className={`mt-2 text-xs ${
              attachmentsTooLarge ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {attachments.length > 0
              ? `${attachments.length} file${
                  attachments.length === 1 ? '' : 's'
                } · ${formatBytes(totalAttachmentBytes)} total`
              : 'Add photos or documents. Keep the total under about 40 MB.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={openPreview}
            disabled={previewing || !bodyText.trim()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-transparent px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <Eye className="h-4 w-4" strokeWidth={1.5} />
            {previewing ? 'Loading…' : 'Preview'}
          </button>
          <button
            onClick={submit}
            disabled={
              sending ||
              !to.trim() ||
              !subject.trim() ||
              !bodyText.trim() ||
              attachmentsTooLarge
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Send className="h-4 w-4" strokeWidth={1.5} />
            {sending ? 'Sending…' : 'Send email'}
          </button>
          {feedback && (
            <span
              className={
                feedback.ok
                  ? 'text-sm text-muted-foreground'
                  : 'text-sm text-destructive'
              }
            >
              {feedback.text}
            </span>
          )}
        </div>
      </div>

      {previewHtml !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-6"
          onClick={() => setPreviewHtml(null)}
        >
          <div
            className="flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-background sm:h-[80vh] sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  Email preview
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {subject.trim() || 'No subject'} &middot; to{' '}
                  {to.trim() || '—'}
                </p>
              </div>
              <button
                onClick={() => setPreviewHtml(null)}
                aria-label="Close preview"
                className="ml-3 shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" strokeWidth={1.5} />
              </button>
            </div>
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              className="flex-1 w-full border-0 bg-white"
            />
          </div>
        </div>
      )}

      {contactPrompt && (
        <SaveContactPrompt
          email={contactPrompt}
          onClose={() => setContactPrompt(null)}
        />
      )}
    </div>
  )
}
