'use client'

import { useState, useTransition } from 'react'
import {
  Mail,
  ArchiveRestore,
  Trash2,
  CornerUpLeft,
  Forward,
  Compass,
  ShoppingBag,
  Send,
  RefreshCw,
  ArrowLeft,
  FolderInput,
  Tag,
  Check,
  Search,
} from 'lucide-react'
import {
  markRead,
  setArchived,
  deleteMessage,
  sendMessage,
  refreshInbox,
  moveToFolder,
  type Folder,
} from '@/app/actions/messages'
import { setMessageLabel, createLabel } from '@/app/actions/mail-organize'
import { SaveContactPrompt } from '@/components/admin/save-contact-prompt'
import { MailSidebar } from '@/components/admin/mail-sidebar'
import { useT } from '@/lib/i18n/context'
import { cn } from '@/lib/utils'

export type LabelLite = { id: number; name: string; color: string }
export type FolderLite = { id: number; name: string }

// Preset colors offered when creating a label inline (e.g. "Nujno" = red).
const LABEL_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
]

export type Message = {
  id: number
  direction: string
  source: string
  name: string
  email: string
  phone: string
  subject: string
  body: string
  meta: string
  read: boolean
  archived: boolean
  folderId: number | null
  labels: LabelLite[]
  createdAt: string | Date
}

const SOURCE_META: Record<string, { label: string; icon: typeof Mail }> = {
  contact: { label: 'Contact', icon: Mail },
  excursion: { label: 'Excursion', icon: Compass },
  order: { label: 'Order', icon: ShoppingBag },
  email: { label: 'Sent', icon: Send },
}

function fmtDate(d: string | Date) {
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function InboxManager({
  initial,
  folder,
  folderId,
  folders,
  labels,
  activeKey,
}: {
  initial: Message[]
  folder: Folder
  folderId?: number
  folders: FolderLite[]
  labels: LabelLite[]
  activeKey: string
}) {
  const t = useT()
  const [items, setItems] = useState<Message[]>(initial)
  const [selectedId, setSelectedId] = useState<number | null>(
    initial[0]?.id ?? null,
  )
  const [pending, startTransition] = useTransition()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  // Labels can be created inline from a message, so keep them in local state.
  const [labelList, setLabelList] = useState<LabelLite[]>(labels)

  const isTrash = folder === 'izbrisano'
  const selected = items.find((m) => m.id === selectedId) ?? null

  // Filter the current folder's messages by sender, email, subject, the
  // message body, or a label — so searching also matches words inside emails.
  const query = search.trim().toLowerCase()
  const visibleItems = query
    ? items.filter((m) =>
        [
          m.name,
          m.email,
          m.subject,
          m.body,
          ...m.labels.map((l) => l.name),
        ]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(query)),
      )
    : items

  // Drop a dragged message onto a sidebar folder (null = main inbox).
  function handleDropMessage(targetFolderId: number | null, messageId: number) {
    setDraggingId(null)
    const msg = items.find((m) => m.id === messageId)
    if (!msg) return
    // Only inbound mail can be filed; outbound/trash stays put.
    if (msg.direction !== 'inbound' || isTrash) return
    if (msg.folderId === targetFolderId) return
    handleMoveToFolder(msg, targetFolderId)
  }

  // Update one message in local state (used by folder-move + label toggles).
  function patchMessage(id: number, patch: Partial<Message>) {
    setItems((prev) =>
      prev.map((m) => (m.id === id ? { ...m, ...patch } : m)),
    )
  }

  function handleMoveToFolder(m: Message, targetFolderId: number | null) {
    // When viewing a specific folder (inbox or custom), a moved message leaves
    // the current view.
    const leavesView =
      (folder === 'prejeto' && targetFolderId !== null) ||
      (typeof folderId === 'number' && targetFolderId !== folderId)
    if (leavesView) {
      setItems((prev) => prev.filter((x) => x.id !== m.id))
      if (selectedId === m.id) setSelectedId(null)
    } else {
      patchMessage(m.id, { folderId: targetFolderId })
    }
    startTransition(() => {
      moveToFolder(m.id, targetFolderId)
    })
  }

  function handleToggleLabel(m: Message, label: LabelLite, on: boolean) {
    const nextLabels = on
      ? [...m.labels.filter((l) => l.id !== label.id), label]
      : m.labels.filter((l) => l.id !== label.id)
    patchMessage(m.id, { labels: nextLabels })
    startTransition(() => {
      setMessageLabel(m.id, label.id, on)
    })
  }

  // Create a brand-new label and immediately apply it to the given message.
  async function handleCreateLabel(
    m: Message,
    name: string,
    color: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await createLabel(name, color)
    if (!res.ok || res.id == null) {
      return { ok: false, error: res.error ?? 'Failed to create label.' }
    }
    const newLabel: LabelLite = { id: res.id, name: name.trim(), color }
    setLabelList((prev) =>
      [...prev, newLabel].sort((a, b) => a.name.localeCompare(b.name)),
    )
    handleToggleLabel(m, newLabel, true)
    return { ok: true }
  }

  async function refresh() {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const fresh = (await refreshInbox({ folder, folderId })) as Message[]
      const prevIds = new Set(items.map((m) => m.id))
      const newCount = fresh.filter((m) => !prevIds.has(m.id)).length
      setItems(fresh)
      if (selectedId === null && fresh[0]) setSelectedId(fresh[0].id)
      setRefreshMsg(
        newCount > 0
          ? `${newCount} ${t(newCount > 1 ? 'new messages' : 'new message')}.`
          : t('No new messages.'),
      )
    } catch {
      setRefreshMsg(t('Refresh failed. Please try again.'))
    } finally {
      setRefreshing(false)
    }
  }

  function open(m: Message) {
    setSelectedId(m.id)
    if (!m.read && m.direction === 'inbound') {
      setItems((prev) =>
        prev.map((x) => (x.id === m.id ? { ...x, read: true } : x)),
      )
      startTransition(() => markRead(m.id, true))
    }
  }

  // Move to trash (from Prejeto/Poslano) or restore (from Izbrisano).
  function moveOrRestore(m: Message) {
    setItems((prev) => prev.filter((x) => x.id !== m.id))
    if (selectedId === m.id) setSelectedId(null)
    startTransition(() => setArchived(m.id, !isTrash))
  }

  // Permanent delete (only offered in trash).
  function removeForever(m: Message) {
    setItems((prev) => prev.filter((x) => x.id !== m.id))
    if (selectedId === m.id) setSelectedId(null)
    startTransition(() => deleteMessage(m.id))
  }

  const emptyLabel =
    folder === 'poslano'
      ? t('No sent messages.')
      : folder === 'izbrisano'
        ? t('Trash is empty.')
        : t('No messages.')

  return (
    <div className="grid gap-6 lg:grid-cols-[210px_minmax(0,340px)_1fr]">
      {/* Folder navigation + drag-and-drop drop targets */}
      <MailSidebar
        activeKey={activeKey}
        folders={folders}
        onDropMessage={handleDropMessage}
        dragActive={draggingId !== null}
      />

      {/* List — hidden on mobile once a message is open (master-detail) */}
      <div
        className={cn(
          'flex flex-col gap-2',
          selected && 'hidden lg:flex',
        )}
      >
        <div className="mb-1 flex items-center gap-3">
          <button
            onClick={refresh}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            <RefreshCw
              className={cn('h-4 w-4', refreshing && 'animate-spin')}
              strokeWidth={1.5}
            />
            {refreshing ? t('Checking…') : t('Send & receive')}
          </button>
          {refreshMsg && (
            <span className="text-xs text-muted-foreground">{refreshMsg}</span>
          )}
        </div>
        <div className="relative mb-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.5}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t(
              'Search by sender, email, subject, content or label…',
            )}
            className="input w-full pl-9"
          />
        </div>
        {folders.length > 0 && !isTrash && folder !== 'poslano' && (
          <p className="mb-1 text-xs text-muted-foreground">
            {t('Tip: drag a message onto a folder on the left to file it.')}
          </p>
        )}
        {visibleItems.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
            {query ? t('No results for your search.') : emptyLabel}
          </p>
        )}
        {visibleItems.map((m) => {
          const meta = SOURCE_META[m.source] ?? SOURCE_META.contact
          const Icon = meta.icon
          const active = m.id === selectedId
          const outbound = m.direction === 'outbound'
          // Only inbound mail (outside the trash) can be filed by dragging.
          const draggable = m.direction === 'inbound' && !isTrash
          return (
            <button
              key={m.id}
              onClick={() => open(m)}
              draggable={draggable}
              onDragStart={
                draggable
                  ? (e) => {
                      e.dataTransfer.setData('text/plain', String(m.id))
                      e.dataTransfer.effectAllowed = 'move'
                      setDraggingId(m.id)
                    }
                  : undefined
              }
              onDragEnd={draggable ? () => setDraggingId(null) : undefined}
              className={cn(
                'flex w-full flex-col gap-1 rounded-lg border p-3 text-left transition-colors',
                active
                  ? 'border-accent bg-accent/5'
                  : 'border-border hover:border-accent/50',
                !m.read && m.direction === 'inbound' && 'bg-accent/[0.03]',
                draggable && 'cursor-grab active:cursor-grabbing',
                draggingId === m.id && 'opacity-50',
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className="h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  {outbound ? t('Sent') : t(meta.label)}
                </span>
                {!m.read && m.direction === 'inbound' && (
                  <span
                    className="h-2 w-2 rounded-full bg-accent"
                    aria-label={t('Unread')}
                  />
                )}
                <span className="ml-auto text-[11px] text-muted-foreground">
                  {fmtDate(m.createdAt)}
                </span>
              </div>
              <span className="truncate text-sm font-medium text-foreground">
                {outbound ? `${t('To:')} ${m.email}` : m.name || m.email}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {m.subject}
              </span>
              {m.labels.length > 0 && (
                <span className="mt-1 flex flex-wrap gap-1">
                  {m.labels.map((l) => (
                    <span
                      key={l.id}
                      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        backgroundColor: `${l.color}22`,
                        color: l.color,
                      }}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: l.color }}
                      />
                      {l.name}
                    </span>
                  ))}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Detail — hidden on mobile until a message is selected */}
      <div
        className={cn(
          'rounded-lg border border-border bg-card p-4 sm:p-5 lg:p-6',
          !selected && 'hidden lg:block',
        )}
      >
        {!selected ? (
          <p className="text-muted-foreground">{t('Select a message to view.')}</p>
        ) : (
          <>
            {/* Back to list — mobile only */}
            <button
              onClick={() => setSelectedId(null)}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground lg:hidden"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
              {t('Back to list')}
            </button>
            <MessageDetail
              key={selected.id}
              message={selected}
              isTrash={isTrash}
              pending={pending}
              folders={folders}
              labels={labelList}
              onMoveOrRestore={() => moveOrRestore(selected)}
              onDeleteForever={() => removeForever(selected)}
              onMoveToFolder={(fid) => handleMoveToFolder(selected, fid)}
              onToggleLabel={(label, on) =>
                handleToggleLabel(selected, label, on)
              }
              onCreateLabel={(name, color) =>
                handleCreateLabel(selected, name, color)
              }
            />
          </>
        )}
      </div>
    </div>
  )
}

function MessageDetail({
  message,
  isTrash,
  pending,
  folders,
  labels,
  onMoveOrRestore,
  onDeleteForever,
  onMoveToFolder,
  onToggleLabel,
  onCreateLabel,
}: {
  message: Message
  isTrash: boolean
  pending: boolean
  folders: FolderLite[]
  labels: LabelLite[]
  onMoveOrRestore: () => void
  onDeleteForever: () => void
  onMoveToFolder: (folderId: number | null) => void
  onToggleLabel: (label: LabelLite, on: boolean) => void
  onCreateLabel: (
    name: string,
    color: string,
  ) => Promise<{ ok: boolean; error?: string }>
}) {
  const t = useT()
  const [mode, setMode] = useState<'none' | 'reply' | 'forward'>('none')
  const [body, setBody] = useState('')
  const [forwardTo, setForwardTo] = useState('')
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [contactPrompt, setContactPrompt] = useState<string | null>(null)
  const [menu, setMenu] = useState<'none' | 'folder' | 'label'>('none')
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState(LABEL_COLORS[0])
  const [creatingLabel, setCreatingLabel] = useState(false)

  async function submitNewLabel() {
    const name = newLabelName.trim()
    if (!name || creatingLabel) return
    setCreatingLabel(true)
    const res = await onCreateLabel(name, newLabelColor)
    setCreatingLabel(false)
    if (res.ok) {
      setNewLabelName('')
      setNewLabelColor(LABEL_COLORS[0])
    }
  }

  const orderLines = parseOrderLines(message.meta)
  const isInbound = message.direction === 'inbound'
  const labelIds = new Set(message.labels.map((l) => l.id))

  function startReply() {
    setMode('reply')
    setBody('')
    setForwardTo('')
    setFeedback(null)
  }

  function startForward() {
    setMode('forward')
    setForwardTo('')
    setBody(buildForwardBody(message))
    setFeedback(null)
  }

  function cancel() {
    setMode('none')
    setBody('')
    setForwardTo('')
  }

  async function send() {
    const to = mode === 'reply' ? message.email : forwardTo.trim()
    if (!to || !body.trim()) return
    setSending(true)
    setFeedback(null)
    const res = await sendMessage({
      to,
      subject:
        mode === 'reply'
          ? `Re: ${message.subject}`
          : `Fwd: ${message.subject}`,
      body,
      inReplyTo: mode === 'reply' ? message.id : undefined,
    })
    setSending(false)
    if (res.ok) {
      cancel()
      setFeedback(mode === 'reply' ? t('Reply sent.') : t('Message forwarded.'))
      if (!res.contactKnown) setContactPrompt(to)
    } else {
      setFeedback(res.error ?? t('Sending failed.'))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div className="min-w-0">
          <h2 className="break-words font-serif text-xl text-foreground">
            {message.subject}
          </h2>
          <p className="mt-1 break-words text-sm text-muted-foreground">
            {message.direction === 'outbound' ? `${t('To')} ` : `${t('From')} `}
            <span className="text-foreground">
              {message.name || message.email}
            </span>
            {message.name && message.email ? ` · ${message.email}` : ''}
            {message.phone ? ` · ${message.phone}` : ''}
          </p>
          <p className="text-xs text-muted-foreground">
            {fmtDate(message.createdAt)}
          </p>
          {message.labels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {message.labels.map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                  style={{ backgroundColor: `${l.color}22`, color: l.color }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: l.color }}
                  />
                  {l.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          {!isTrash && isInbound && (
            <div className="relative">
              <button
                onClick={() =>
                  setMenu((m) => (m === 'label' ? 'none' : 'label'))
                }
                disabled={pending}
                title={t('Labels')}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <Tag className="h-4 w-4" strokeWidth={1.5} />
              </button>
              {menu === 'label' && (
                <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-border bg-card p-1 shadow-lg">
                  {labels.map((l) => {
                    const on = labelIds.has(l.id)
                    return (
                      <button
                        key={l.id}
                        onClick={() => onToggleLabel(l, !on)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted"
                      >
                        <span
                          className="h-3 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: l.color }}
                        />
                        <span className="flex-1 truncate text-foreground">
                          {l.name}
                        </span>
                        {on && (
                          <Check
                            className="h-4 w-4 text-accent"
                            strokeWidth={1.5}
                          />
                        )}
                      </button>
                    )
                  })}

                  {/* Inline "create a new label" form */}
                  <div className="mt-1 border-t border-border px-2 pb-1 pt-2">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                      {t('New label')}
                    </p>
                    <input
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                          e.preventDefault()
                          submitNewLabel()
                        }
                      }}
                      placeholder={t('e.g. Urgent')}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:border-accent"
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {LABEL_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setNewLabelColor(c)}
                          aria-label={`Color ${c}`}
                          className={cn(
                            'h-5 w-5 rounded-full border-2 transition-transform',
                            newLabelColor === c
                              ? 'scale-110 border-foreground'
                              : 'border-transparent',
                          )}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={submitNewLabel}
                      disabled={!newLabelName.trim() || creatingLabel}
                      className="mt-2 w-full rounded-md bg-primary px-2 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {creatingLabel ? t('Adding…') : t('Add & label')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!isTrash && isInbound && folders.length > 0 && (
            <div className="relative">
              <button
                onClick={() =>
                  setMenu((m) => (m === 'folder' ? 'none' : 'folder'))
                }
                disabled={pending}
                title={t('Move to folder')}
                className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <FolderInput className="h-4 w-4" strokeWidth={1.5} />
              </button>
              {menu === 'folder' && (
                <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-border bg-card p-1 shadow-lg">
                  <button
                    onClick={() => {
                      onMoveToFolder(null)
                      setMenu('none')
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                  >
                    <Mail className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span className="flex-1 truncate">{t('Inbox')}</span>
                    {message.folderId == null && (
                      <Check className="h-4 w-4 text-accent" strokeWidth={1.5} />
                    )}
                  </button>
                  {folders.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        onMoveToFolder(f.id)
                        setMenu('none')
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-muted"
                    >
                      <FolderInput
                        className="h-4 w-4 shrink-0"
                        strokeWidth={1.5}
                      />
                      <span className="flex-1 truncate">{f.name}</span>
                      {message.folderId === f.id && (
                        <Check
                          className="h-4 w-4 text-accent"
                          strokeWidth={1.5}
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <button
            onClick={onMoveOrRestore}
            disabled={pending}
            title={isTrash ? t('Restore') : t('Move to trash')}
            className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            {isTrash ? (
              <ArchiveRestore className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            )}
          </button>
          {isTrash && (
            <button
              onClick={onDeleteForever}
              disabled={pending}
              title={t('Delete permanently')}
              className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            </button>
          )}
        </div>
      </div>

      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
        {message.body}
      </p>

      {orderLines && (
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('Order')}
          </h3>
          <ul className="flex flex-col gap-1 text-sm">
            {orderLines.map((l, i) => (
              <li key={i} className="flex justify-between gap-4">
                <span className="text-foreground">
                  {l.quantity}× {l.name}
                </span>
                <span className="tabular-nums text-muted-foreground">
                  €{l.lineTotal}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!isTrash && (
        <div className="border-t border-border pt-4">
          {mode === 'none' ? (
            <div className="flex flex-wrap items-center gap-2">
              {message.direction === 'inbound' && (
                <button
                  onClick={startReply}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <CornerUpLeft className="h-4 w-4" strokeWidth={1.5} />
                  {t('Reply')}
                </button>
              )}
              <button
                onClick={startForward}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                <Forward className="h-4 w-4" strokeWidth={1.5} />
                {t('Forward')}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {mode === 'reply' ? (
                <p className="text-sm text-muted-foreground">
                  {t('Reply to')}{' '}
                  <span className="text-foreground">{message.email}</span>
                </p>
              ) : (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-foreground">
                    {t('Forward to')}
                  </label>
                  <input
                    type="email"
                    className="input"
                    placeholder="recipient@example.com"
                    value={forwardTo}
                    onChange={(e) => setForwardTo(e.target.value)}
                    autoFocus
                  />
                </div>
              )}
              <textarea
                className="input min-h-[160px] resize-y"
                placeholder={
                  mode === 'reply' ? t('Write a reply…') : t('Add a message…')
                }
                value={body}
                onChange={(e) => setBody(e.target.value)}
                autoFocus={mode === 'reply'}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={send}
                  disabled={
                    sending ||
                    !body.trim() ||
                    (mode === 'forward' && !forwardTo.trim())
                  }
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" strokeWidth={1.5} />
                  {sending
                    ? t('Sending…')
                    : mode === 'reply'
                      ? t('Send reply')
                      : t('Forward')}
                </button>
                <button
                  onClick={cancel}
                  className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t('Cancel')}
                </button>
              </div>
            </div>
          )}
          {feedback && (
            <p className="mt-3 text-sm text-muted-foreground">{feedback}</p>
          )}
        </div>
      )}

      {contactPrompt && (
        <SaveContactPrompt
          email={contactPrompt}
          name={message.direction === 'inbound' ? message.name : ''}
          onClose={() => setContactPrompt(null)}
        />
      )}
    </div>
  )
}

/** Build a quoted "forwarded message" block from an existing message. */
function buildForwardBody(m: Message): string {
  const who =
    m.direction === 'outbound'
      ? `To: ${m.email}`
      : `From: ${m.name ? `${m.name} <${m.email}>` : m.email}`
  return `\n\n---------- Forwarded message ----------\n${who}\nDate: ${fmtDate(
    m.createdAt,
  )}\nSubject: ${m.subject}\n\n${m.body}`
}

type OrderLine = { name: string; quantity: number; lineTotal: number }

function parseOrderLines(meta: string): OrderLine[] | null {
  if (!meta) return null
  try {
    const parsed = JSON.parse(meta)
    if (Array.isArray(parsed?.lines)) return parsed.lines as OrderLine[]
    return null
  } catch {
    return null
  }
}
