'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  UserPlus,
  Search,
  Copy,
  Check,
  Trash2,
  PenLine,
  Mail,
  X,
  StickyNote,
} from 'lucide-react'
import {
  saveContact,
  updateContact,
  deleteContact,
  type Contact,
} from '@/app/actions/contacts'

// Treat a name that is just the email address as "no name", so the name field
// stays clean and the display doesn't show the same email twice.
function cleanName(name: string, email: string) {
  const n = name.trim()
  return n.toLowerCase() === email.trim().toLowerCase() ? '' : n
}

function initials(name: string, email: string) {
  const base = name.trim() || email
  const parts = base.split(/[\s@.]+/).filter(Boolean)
  return (parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('sl-SI', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function ContactsManager({ initial }: { initial: Contact[] }) {
  const [items, setItems] = useState<Contact[]>(initial)
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)

  // Inline editing state
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editNote, setEditNote] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter(
      (c) =>
        c.email.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.note.toLowerCase().includes(q),
    )
  }, [items, query])

  async function add() {
    const e = email.trim().toLowerCase()
    if (!e || !e.includes('@')) {
      setError('Enter a valid email address.')
      return
    }
    setSaving(true)
    setError(null)
    const res = await saveContact({ email: e, name, note })
    setSaving(false)
    if (!res.ok) {
      setError(res.error ?? 'Saving failed.')
      return
    }
    // Optimistically update the local list (upsert by email).
    setItems((prev) => {
      const existing = prev.find((c) => c.email === e)
      if (existing) {
        return prev.map((c) =>
          c.email === e
            ? {
                ...c,
                name: c.name || name.trim(),
                note: c.note || note.trim(),
              }
            : c,
        )
      }
      return [
        {
          id: Date.now(),
          email: e,
          name: name.trim(),
          note: note.trim(),
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]
    })
    setName('')
    setEmail('')
    setNote('')
  }

  function startEdit(c: Contact) {
    setEditId(c.id)
    setEditName(cleanName(c.name, c.email))
    setEditNote(c.note)
  }

  function cancelEdit() {
    setEditId(null)
    setEditName('')
    setEditNote('')
  }

  async function saveEdit(id: number) {
    setItems((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, name: editName.trim(), note: editNote.trim() }
          : c,
      ),
    )
    cancelEdit()
    await updateContact({ id, name: editName, note: editNote })
  }

  async function remove(id: number) {
    setItems((prev) => prev.filter((c) => c.id !== id))
    if (editId === id) cancelEdit()
    await deleteContact(id)
  }

  async function copy(c: Contact) {
    try {
      await navigator.clipboard.writeText(c.email)
      setCopiedId(c.id)
      setTimeout(() => setCopiedId(null), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Add to address book */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" strokeWidth={1.5} />
          <h2 className="text-sm font-medium text-foreground">
            Add to address book
          </h2>
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="input sm:max-w-[240px]"
              placeholder="Name, surname or company"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) add()
              }}
            />
            <input
              type="email"
              className="input flex-1"
              placeholder="address@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) add()
              }}
            />
          </div>
          <textarea
            className="input min-h-[64px] resize-y"
            placeholder="Note (optional) — e.g. guest, agency, language, special requests…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <div className="flex justify-end">
            <button
              onClick={add}
              disabled={saving || !email.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" strokeWidth={1.5} />
              Save
            </button>
          </div>
        </div>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.5}
        />
        <input
          className="input pl-9"
          placeholder="Search by name, email or note…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Count */}
      <p className="text-sm text-muted-foreground">
        {items.length === 0
          ? 'The address book is still empty.'
          : `${filtered.length} of ${items.length} ${
              items.length === 1 ? 'contact' : 'contacts'
            }`}
      </p>

      {/* List */}
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Mail
            className="mx-auto mb-3 h-8 w-8 text-muted-foreground"
            strokeWidth={1.25}
          />
          <p className="text-sm text-muted-foreground">
            Addresses are collected here automatically when you send an email
            and confirm them. You can also add them manually above.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {filtered.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-border bg-card p-3"
            >
              {editId === c.id ? (
                /* Inline edit */
                <div className="flex flex-col gap-2.5">
                  <input
                    className="input"
                    placeholder="Name, surname or company"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                        saveEdit(c.id)
                      if (e.key === 'Escape') cancelEdit()
                    }}
                  />
                  <p className="truncate px-1 text-xs text-muted-foreground">
                    {c.email}
                  </p>
                  <textarea
                    className="input min-h-[60px] resize-y"
                    placeholder="Note (optional)"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveEdit(c.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                    >
                      <Check className="h-4 w-4" strokeWidth={1.5} />
                      Save
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Display */
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-medium uppercase text-primary">
                    {initials(cleanName(c.name, c.email), c.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    {cleanName(c.name, c.email) && (
                      <p className="truncate text-sm font-medium text-foreground">
                        {cleanName(c.name, c.email)}
                      </p>
                    )}
                    <p className="truncate text-sm text-muted-foreground">
                      {c.email}
                    </p>
                    {c.note && (
                      <p className="mt-1 flex items-start gap-1.5 text-xs leading-relaxed text-foreground/80">
                        <StickyNote
                          className="mt-0.5 h-3 w-3 shrink-0 text-accent"
                          strokeWidth={1.5}
                        />
                        <span className="whitespace-pre-wrap break-words">
                          {c.note}
                        </span>
                      </p>
                    )}
                    <p className="mt-0.5 text-xs text-muted-foreground/70">
                      Added {fmtDate(c.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      onClick={() => startEdit(c)}
                      aria-label={`Edit ${c.email}`}
                      title="Edit"
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                    >
                      <PenLine className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <Link
                      href={`/admin/inbox?folder=compose&to=${encodeURIComponent(c.email)}`}
                      aria-label={`Compose to ${c.email}`}
                      title="Compose"
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                    >
                      <Mail className="h-4 w-4" strokeWidth={1.5} />
                    </Link>
                    <button
                      onClick={() => copy(c)}
                      aria-label={`Copy ${c.email}`}
                      title="Copy email"
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      {copiedId === c.id ? (
                        <Check
                          className="h-4 w-4 text-primary"
                          strokeWidth={1.5}
                        />
                      ) : (
                        <Copy className="h-4 w-4" strokeWidth={1.5} />
                      )}
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      aria-label={`Delete ${c.email}`}
                      title="Delete"
                      className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
