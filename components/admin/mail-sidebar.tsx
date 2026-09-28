'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  Inbox,
  Send,
  Trash2,
  Users,
  Settings,
  Folder,
  SquarePen,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useT } from '@/lib/i18n/context'
import type { FolderLite } from '@/components/admin/inbox-manager'

/**
 * Left-hand navigation for the mailbox. Renders the built-in views plus every
 * custom folder. When `onDropMessage` is provided, the inbox + custom-folder
 * rows also act as drag-and-drop targets: dragging a message onto a row files
 * it into that folder (null = back to the main inbox).
 */
export function MailSidebar({
  activeKey,
  folders,
  onDropMessage,
  dragActive = false,
}: {
  activeKey: string
  folders: FolderLite[]
  onDropMessage?: (folderId: number | null, messageId: number) => void
  dragActive?: boolean
}) {
  const [overKey, setOverKey] = useState<string | null>(null)
  const t = useT()

  function readId(e: React.DragEvent): number | null {
    const raw = e.dataTransfer.getData('text/plain')
    const id = Number(raw)
    return Number.isFinite(id) && id > 0 ? id : null
  }

  function dropProps(key: string, folderId: number | null) {
    if (!onDropMessage) return {}
    return {
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        if (overKey !== key) setOverKey(key)
      },
      onDragLeave: () => setOverKey((k) => (k === key ? null : k)),
      onDrop: (e: React.DragEvent) => {
        e.preventDefault()
        setOverKey(null)
        const id = readId(e)
        if (id != null) onDropMessage(folderId, id)
      },
    }
  }

  const rowClass = (key: string, droppable: boolean) =>
    cn(
      'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
      activeKey === key
        ? 'bg-primary text-primary-foreground'
        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      // Highlight valid drop targets while a drag is in progress.
      droppable && dragActive && activeKey !== key && 'ring-1 ring-accent/40',
      droppable && overKey === key && 'bg-accent/15 text-foreground ring-2 ring-accent',
    )

  return (
    <nav className="scrollbar-hide flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      <Link
        href="/admin/inbox?folder=compose"
        className={cn(
          'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors lg:mb-1',
          activeKey === 'compose'
            ? 'bg-accent text-accent-foreground'
            : 'bg-accent/90 text-accent-foreground hover:bg-accent',
        )}
      >
        <SquarePen className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span className="truncate">{t('New email')}</span>
      </Link>

      <Link href="/admin/inbox" className={rowClass('prejeto', true)} {...dropProps('prejeto', null)}>
        <Inbox className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span className="truncate">{t('Inbox')}</span>
      </Link>

      {folders.length > 0 && (
        <div className="hidden lg:my-1 lg:block lg:h-px lg:bg-border" aria-hidden />
      )}
      {folders.map((f) => {
        const key = `f${f.id}`
        return (
          <Link
            key={f.id}
            href={`/admin/inbox?folder=${key}`}
            className={rowClass(key, true)}
            {...dropProps(key, f.id)}
          >
            <Folder className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{f.name}</span>
          </Link>
        )
      })}

      <div className="hidden lg:my-1 lg:block lg:h-px lg:bg-border" aria-hidden />

      <Link href="/admin/inbox?folder=poslano" className={rowClass('poslano', false)}>
        <Send className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span className="truncate">{t('Sent')}</span>
      </Link>
      <Link href="/admin/inbox?folder=izbrisano" className={rowClass('izbrisano', false)}>
        <Trash2 className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span className="truncate">{t('Trash')}</span>
      </Link>
      <Link href="/admin/inbox?folder=stiki" className={rowClass('stiki', false)}>
        <Users className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span className="truncate">{t('Contacts')}</span>
      </Link>

      <div className="hidden lg:my-1 lg:block lg:h-px lg:bg-border" aria-hidden />

      <Link
        href="/admin/inbox?folder=urejanje"
        title={t('Folders, rules and labels')}
        className={rowClass('urejanje', false)}
      >
        <Settings className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span className="truncate">{t('Edit folders & labels')}</span>
      </Link>
    </nav>
  )
}
