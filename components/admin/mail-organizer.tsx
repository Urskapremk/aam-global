'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Folder, Tag, Filter, Plus, Trash2, Pencil, Check, X } from 'lucide-react'
import {
  createFolder,
  renameFolder,
  deleteFolder,
  createRule,
  deleteRule,
  createLabel,
  updateLabel,
  deleteLabel,
} from '@/app/actions/mail-organize'

export type FolderRow = { id: number; name: string }
export type RuleRow = {
  id: number
  fromEmail: string
  folderId: number
  folderName: string | null
}
export type LabelRow = { id: number; name: string; color: string }

// A small friendly palette to pick label colors from.
const LABEL_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // amber
  '#22c55e', // green
  '#14b8a6', // teal
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
]

export function MailOrganizer({
  folders,
  rules,
  labels,
}: {
  folders: FolderRow[]
  rules: RuleRow[]
  labels: LabelRow[]
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <FoldersCard folders={folders} />
      <RulesCard folders={folders} rules={rules} />
      <LabelsCard labels={labels} />
    </div>
  )
}

function Card({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Folder
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4.5 w-4.5" strokeWidth={1.5} />
        </span>
        <div>
          <h2 className="font-serif text-lg text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

// ------------------------------- Folders -----------------------------------

function FoldersCard({ folders }: { folders: FolderRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState('')
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  function add() {
    const clean = name.trim()
    if (!clean) return
    setName('')
    start(async () => {
      await createFolder(clean)
      router.refresh()
    })
  }

  function saveRename(id: number) {
    const clean = editName.trim()
    if (!clean) return
    setEditId(null)
    start(async () => {
      await renameFolder(id, clean)
      router.refresh()
    })
  }

  function remove(id: number) {
    start(async () => {
      await deleteFolder(id)
      router.refresh()
    })
  }

  return (
    <Card
      icon={Folder}
      title="Folders"
      description="Create folders to organize incoming mail."
    >
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Folder name (e.g. Reservations)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) add()
          }}
        />
        <button
          onClick={add}
          disabled={pending || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" strokeWidth={1.5} />
          Add
        </button>
      </div>

      <ul className="flex flex-col gap-2">
        {folders.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No folders.
          </li>
        )}
        {folders.map((f) => (
          <li
            key={f.id}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
          >
            {editId === f.id ? (
              <>
                <input
                  className="input flex-1"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                      saveRename(f.id)
                    if (e.key === 'Escape') setEditId(null)
                  }}
                  autoFocus
                />
                <button
                  onClick={() => saveRename(f.id)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Save"
                >
                  <Check className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </>
            ) : (
              <>
                <Folder
                  className="h-4 w-4 shrink-0 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="flex-1 truncate text-sm text-foreground">
                  {f.name}
                </span>
                <button
                  onClick={() => {
                    setEditId(f.id)
                    setEditName(f.name)
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={`Rename ${f.name}`}
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => remove(f.id)}
                  disabled={pending}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${f.name}`}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

// -------------------------------- Rules ------------------------------------

function RulesCard({
  folders,
  rules,
}: {
  folders: FolderRow[]
  rules: RuleRow[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [email, setEmail] = useState('')
  const [folderId, setFolderId] = useState<number | ''>('')

  function add() {
    const clean = email.trim()
    if (!clean || !folderId) return
    setEmail('')
    const fid = Number(folderId)
    setFolderId('')
    start(async () => {
      await createRule(clean, fid)
      router.refresh()
    })
  }

  function remove(id: number) {
    start(async () => {
      await deleteRule(id)
      router.refresh()
    })
  }

  return (
    <Card
      icon={Filter}
      title="Rules"
      description="Mail from a specific address automatically goes to the chosen folder."
    >
      {folders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
          Create at least one folder first.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          <input
            className="input"
            type="email"
            placeholder="sender@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <div className="flex gap-2">
            <select
              className="input flex-1"
              value={folderId}
              onChange={(e) =>
                setFolderId(e.target.value ? Number(e.target.value) : '')
              }
            >
              <option value="">Choose a folder…</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <button
              onClick={add}
              disabled={pending || !email.trim() || !folderId}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" strokeWidth={1.5} />
              Add
            </button>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {rules.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No rules.
          </li>
        )}
        {rules.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-foreground">
                {r.fromEmail}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                → {r.folderName ?? 'Unknown folder'}
              </span>
            </span>
            <button
              onClick={() => remove(r.id)}
              disabled={pending}
              className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
              aria-label={`Delete rule for ${r.fromEmail}`}
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  )
}

// -------------------------------- Labels -----------------------------------

function LabelsCard({ labels }: { labels: LabelRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [name, setName] = useState('')
  const [color, setColor] = useState(LABEL_COLORS[0])
  const [editId, setEditId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')
  const [editColor, setEditColor] = useState(LABEL_COLORS[0])

  function add() {
    const clean = name.trim()
    if (!clean) return
    setName('')
    const c = color
    start(async () => {
      await createLabel(clean, c)
      router.refresh()
    })
  }

  function saveEdit(id: number) {
    const clean = editName.trim()
    if (!clean) return
    setEditId(null)
    start(async () => {
      await updateLabel(id, clean, editColor)
      router.refresh()
    })
  }

  function remove(id: number) {
    start(async () => {
      await deleteLabel(id)
      router.refresh()
    })
  }

  return (
    <Card
      icon={Tag}
      title="Labels"
      description="Name and color labels (e.g. Urgent) for messages."
    >
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Label name (e.g. Urgent)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) add()
            }}
          />
          <button
            onClick={add}
            disabled={pending || !name.trim()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Add
          </button>
        </div>
        <ColorPicker value={color} onChange={setColor} />
      </div>

      <ul className="flex flex-col gap-2">
        {labels.length === 0 && (
          <li className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
            No labels.
          </li>
        )}
        {labels.map((l) => (
          <li
            key={l.id}
            className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2"
          >
            {editId === l.id ? (
              <>
                <div className="flex items-center gap-2">
                  <input
                    className="input flex-1"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.nativeEvent.isComposing)
                        saveEdit(l.id)
                      if (e.key === 'Escape') setEditId(null)
                    }}
                    autoFocus
                  />
                  <button
                    onClick={() => saveEdit(l.id)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    aria-label="Save"
                  >
                    <Check className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => setEditId(null)}
                    className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
                <ColorPicker value={editColor} onChange={setEditColor} />
              </>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                  style={{ backgroundColor: `${l.color}22`, color: l.color }}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  {l.name}
                </span>
                <span className="flex-1" />
                <button
                  onClick={() => {
                    setEditId(l.id)
                    setEditName(l.name)
                    setEditColor(l.color)
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
                  aria-label={`Edit ${l.name}`}
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.5} />
                </button>
                <button
                  onClick={() => remove(l.id)}
                  disabled={pending}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive"
                  aria-label={`Delete ${l.name}`}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (c: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LABEL_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-label={`Color ${c}`}
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 transition-transform hover:scale-110"
          style={{
            backgroundColor: c,
            borderColor: value === c ? 'var(--foreground)' : 'transparent',
          }}
        >
          {value === c && (
            <Check className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          )}
        </button>
      ))}
    </div>
  )
}
