'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Check } from 'lucide-react'
import { CONTENT_FIELDS } from '@/lib/site-content'
import { ImageUpload } from '@/components/admin/image-upload'
import { saveContent } from '@/app/actions/site-content'

export function ContentEditor({
  initial,
}: {
  initial: Record<string, string>
}) {
  const router = useRouter()
  const [values, setValues] = useState<Record<string, string>>(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const groups = Array.from(new Set(CONTENT_FIELDS.map((f) => f.group)))

  function set(key: string, value: string) {
    setValues((v) => ({ ...v, [key]: value }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      await saveContent(values)
      setSaved(true)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-foreground">Texts &amp; images</h1>
        <p className="text-sm text-muted-foreground">
          Edit the main texts and photos on the home page.
        </p>
      </div>

      <div className="flex flex-col gap-8">
        {groups.map((group) => (
          <div
            key={group}
            className="rounded-xl border border-border bg-background p-5"
          >
            <h2 className="mb-4 font-serif text-lg text-foreground">{group}</h2>
            <div className="flex flex-col gap-4">
              {CONTENT_FIELDS.filter((f) => f.group === group).map((field) => (
                <div key={field.key}>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {field.label}
                  </label>
                  {field.type === 'text' && (
                    <input
                      value={values[field.key] ?? ''}
                      onChange={(e) => set(field.key, e.target.value)}
                      className="input"
                    />
                  )}
                  {field.type === 'textarea' && (
                    <textarea
                      value={values[field.key] ?? ''}
                      onChange={(e) => set(field.key, e.target.value)}
                      rows={4}
                      className="input"
                    />
                  )}
                  {field.type === 'image' && (
                    <ImageUpload
                      value={values[field.key] || null}
                      onChange={(url) => set(field.key, url ?? '')}
                      label=""
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 mt-8 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary/90 disabled:opacity-60"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <Check className="h-4 w-4" />
          ) : null}
          {saved ? 'Saved' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}
