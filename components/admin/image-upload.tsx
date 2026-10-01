'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { Upload, X, Loader2, ClipboardPaste } from 'lucide-react'
import { uploadImage } from '@/app/actions/upload'
import { shrinkImageToDataUrl, dataUrlToFile } from '@/lib/image-client'

function imageFromClipboardData(data: DataTransfer | null): File | null {
  if (!data) return null
  for (const item of Array.from(data.items)) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const blob = item.getAsFile()
      if (blob) {
        const ext = blob.type.split('/')[1] || 'png'
        return new File([blob], `screenshot-${Date.now()}.${ext}`, {
          type: blob.type,
        })
      }
    }
  }
  return null
}

// Several upload fields can listen for Ctrl+V on the same page; only the one the
// user last interacted with (or the first mounted) may take the pasted image.
const pasteFieldIds: string[] = []
let activePasteFieldId: string | null = null

function isPasteTarget(id: string) {
  const target =
    activePasteFieldId && pasteFieldIds.includes(activePasteFieldId)
      ? activePasteFieldId
      : pasteFieldIds[0]
  return target === id
}

export function ImageUpload({
  value,
  onChange,
  label = 'Image',
  listenPaste = false,
}: {
  value: string | null
  onChange: (url: string | null) => void
  label?: string
  /** Also accept Ctrl/Cmd+V anywhere on the page while this field is mounted. */
  listenPaste?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadingRef = useRef(false)
  const fieldId = useId()

  async function handleFile(file: File) {
    if (uploadingRef.current) return
    uploadingRef.current = true
    setError(null)
    setUploading(true)
    try {
      // Screenshots are multi-MB PNGs; Server Action bodies are capped, so
      // shrink to a JPEG first. GIF/SVG are kept as-is (animation/vector).
      let toSend = file
      if (!/image\/(gif|svg)/.test(file.type)) {
        try {
          const dataUrl = await shrinkImageToDataUrl(file, 1920, 0.85)
          toSend = dataUrlToFile(dataUrl, `${file.name.replace(/\.[^.]+$/, '')}.jpg`)
        } catch {
          toSend = file
        }
      }
      const fd = new FormData()
      fd.append('file', toSend)
      const res = await uploadImage(fd)
      if (res.error) setError(res.error)
      else if (res.url) onChange(res.url)
    } catch (err) {
      console.error('Image upload failed:', err)
      setError('Nalaganje ni uspelo.')
    } finally {
      uploadingRef.current = false
      setUploading(false)
    }
  }

  async function pasteFromClipboard() {
    setError(null)
    if (!navigator.clipboard?.read) {
      setError('Brskalnik ne podpira branja odložišča — pritisnite Ctrl+V.')
      return
    }
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) {
          const blob = await item.getType(type)
          const ext = type.split('/')[1] || 'png'
          await handleFile(
            new File([blob], `screenshot-${Date.now()}.${ext}`, { type }),
          )
          return
        }
      }
      setError('V odložišču ni slike. Najprej naredite posnetek zaslona.')
    } catch {
      setError('Pritisnite Ctrl+V — slika bo dodana v to polje.')
    }
  }

  // Only reacts when the clipboard holds an image, so text pastes into other
  // inputs of the form are unaffected.
  const handleFileRef = useRef(handleFile)
  handleFileRef.current = handleFile
  useEffect(() => {
    if (!listenPaste) return
    pasteFieldIds.push(fieldId)
    function onPaste(e: ClipboardEvent) {
      if (!isPasteTarget(fieldId)) return
      const file = imageFromClipboardData(e.clipboardData)
      if (!file) return
      e.preventDefault()
      handleFileRef.current(file)
    }
    document.addEventListener('paste', onPaste)
    return () => {
      document.removeEventListener('paste', onPaste)
      const i = pasteFieldIds.indexOf(fieldId)
      if (i >= 0) pasteFieldIds.splice(i, 1)
      if (activePasteFieldId === fieldId) activePasteFieldId = null
    }
  }, [listenPaste, fieldId])

  return (
    <div
      onPointerDownCapture={() => {
        activePasteFieldId = fieldId
      }}
      onFocusCapture={() => {
        activePasteFieldId = fieldId
      }}
    >
      <label className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>

      <div className="flex flex-wrap items-start gap-3">
        {value ? (
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={value || '/placeholder.svg'}
              alt="Preview"
              className="h-36 w-52 rounded-lg border border-border object-cover"
            />
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label="Remove image"
              className="absolute -right-2 -top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-background shadow"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onPaste={(e) => {
              const file = imageFromClipboardData(e.clipboardData)
              if (file) {
                e.preventDefault()
                handleFile(file)
              }
            }}
            disabled={uploading}
            className="flex h-36 w-52 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-secondary text-sm text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
          >
            {uploading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Uploading…
              </>
            ) : (
              <>
                <Upload className="h-5 w-5" />
                Upload image
              </>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={pasteFromClipboard}
          disabled={uploading}
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-foreground transition-colors hover:border-accent disabled:opacity-50"
        >
          <ClipboardPaste className="h-4 w-4" />
          {value ? 'Replace with screenshot' : 'Paste screenshot'}
          <span className="text-xs text-muted-foreground">Ctrl+V</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />

      {error && <p className="mt-1.5 text-sm text-red-500">{error}</p>}
    </div>
  )
}
