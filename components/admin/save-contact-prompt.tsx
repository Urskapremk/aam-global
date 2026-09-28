'use client'

import { useState } from 'react'
import { UserPlus, Check, X } from 'lucide-react'
import { saveContact } from '@/app/actions/contacts'

/**
 * Modal shown after an email is sent, asking whether to save the recipient's
 * address into the contacts database. Render it conditionally from a parent
 * and pass the recipient email; `onClose` clears it.
 */
export function SaveContactPrompt({
  email,
  name,
  onClose,
}: {
  email: string
  name?: string
  onClose: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    await saveContact({ email, name })
    setSaving(false)
    setSaved(true)
    setTimeout(onClose, 900)
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent/10">
          <UserPlus className="h-5 w-5 text-accent" strokeWidth={1.5} />
        </div>
        <h3 className="font-serif text-lg text-foreground">
          Save to contacts?
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Should I add{' '}
          <span className="font-medium text-foreground">{email}</span> to your
          address book?
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
            No, thanks
          </button>
          <button
            onClick={save}
            disabled={saving || saved}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <Check className="h-4 w-4" strokeWidth={1.5} />
            {saved ? 'Saved' : saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
