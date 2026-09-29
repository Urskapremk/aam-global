'use client'

import { ClipboardPaste, FileText, Loader2, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'

import { deleteHrDocument, getHrDocuments, uploadHrDocument } from '@/app/actions/hr-documents'
import { useT } from '@/lib/i18n/context'
import { dataUrlToFile, shrinkImageToDataUrl } from '@/lib/image-client'

import { labelClass } from './hr-shared'

const DOC_KINDS: { id: string; label: string }[] = [
  { id: 'cin', label: 'ID card (CIN)' },
  { id: 'passport', label: 'Passport' },
  { id: 'cnaps', label: 'CNAPS card' },
  { id: 'license', label: 'Boat licence / certificate' },
  { id: 'contract', label: 'Signed contract' },
  { id: 'other', label: 'Other' },
]

function kindLabel(id: string) {
  return DOC_KINDS.find((k) => k.id === id)?.label ?? 'Other'
}

export function HrStaffDocuments({ staffId }: { staffId: string }) {
  const t = useT()
  const { data, mutate, isLoading } = useSWR(['hr-documents', staffId], () => getHrDocuments(staffId))
  const [kind, setKind] = useState('cin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)

  async function upload(file: File) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      // Phone photos and screenshots are several MB; shrink images so they fit
      // the Server Action body limit. PDFs are sent unchanged.
      let toSend = file
      if (file.type.startsWith('image/') && !/gif|svg/.test(file.type)) {
        try {
          const dataUrl = await shrinkImageToDataUrl(file, 2200, 0.88)
          toSend = dataUrlToFile(dataUrl, `${file.name.replace(/\.[^.]+$/, '')}.jpg`)
        } catch {
          toSend = file
        }
      }
      const fd = new FormData()
      fd.append('file', toSend)
      fd.append('staffId', staffId)
      fd.append('kind', kind)
      const res = await uploadHrDocument(fd)
      if ('error' in res) setError(res.error)
      else mutate()
    } catch (err) {
      console.error('HR document upload failed:', err)
      setError(t('Upload failed.'))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  async function pasteFromClipboard() {
    setError(null)
    if (!navigator.clipboard?.read) {
      setError(t('Browser cannot read the clipboard — press Ctrl+V.'))
      return
    }
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((x) => x.startsWith('image/'))
        if (type) {
          const blob = await item.getType(type)
          await upload(new File([blob], `screenshot-${Date.now()}.${type.split('/')[1] || 'png'}`, { type }))
          return
        }
      }
      setError(t('No image in the clipboard.'))
    } catch {
      setError(t('Clipboard access denied — press Ctrl+V.'))
    }
  }

  const uploadRef = useRef(upload)
  uploadRef.current = upload
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      // Only when focus is inside this worker's card, so two open cards
      // don't both receive the same screenshot.
      if (!rootRef.current?.closest('li')?.contains(document.activeElement)) return
      const item = Array.from(e.clipboardData?.items ?? []).find(
        (i) => i.kind === 'file' && i.type.startsWith('image/'),
      )
      const blob = item?.getAsFile()
      if (!blob) return
      e.preventDefault()
      uploadRef.current(new File([blob], `screenshot-${Date.now()}.png`, { type: blob.type }))
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
  }, [])

  return (
    <div ref={rootRef} className="mt-5 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-medium text-foreground">{t('Personal documents')}</h4>
        <p className="text-[11px] text-muted-foreground">{t('Stored privately, visible only in admin.')}</p>
      </div>

      <div className="mt-3">
        <span className={labelClass}>{t('Document type')}</span>
        <div className="flex flex-wrap gap-2">
          {DOC_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
              className={`min-h-9 cursor-pointer rounded-full border px-3 text-xs font-medium transition ${
                kind === k.id
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {t(k.label)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
          {t('Upload photo or PDF')}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={pasteFromClipboard}
          className="flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border border-border px-4 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
        >
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
          {t('Paste screenshot')}
          <span className="text-muted-foreground">Ctrl+V</span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          capture={undefined}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) upload(f)
            e.target.value = ''
          }}
        />
      </div>
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <div className="mt-4">
        {isLoading ? (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('Loading…')}
          </p>
        ) : !data?.length ? (
          <p className="text-xs text-muted-foreground">{t('No documents yet.')}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((d) => {
              const src = `/api/hr/document/${d.id}`
              const isImage = d.contentType.startsWith('image/')
              return (
                <li key={d.id} className="overflow-hidden rounded-xl border border-border bg-muted/20">
                  <a href={src} target="_blank" rel="noopener noreferrer" className="block">
                    {isImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={src}
                        alt={`${t(kindLabel(d.kind))} — ${d.name}`}
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-36 items-center justify-center text-muted-foreground">
                        <FileText className="h-8 w-8" aria-hidden />
                      </div>
                    )}
                  </a>
                  <div className="flex items-center justify-between gap-2 p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-foreground">{t(kindLabel(d.kind))}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {new Date(d.createdAt).toLocaleDateString('sl-SI')}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={t('Delete document')}
                      onClick={async () => {
                        if (!confirm(t('Delete this document?'))) return
                        await deleteHrDocument(d.id)
                        mutate()
                      }}
                      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-destructive transition hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
