import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/admin-auth'
import { getMessages, type Folder } from '@/app/actions/messages'
import { getContacts } from '@/app/actions/contacts'
import {
  getFolders,
  getLabels,
  getRules,
} from '@/app/actions/mail-organize'
import { InboxManager, type Message } from '@/components/admin/inbox-manager'
import { ContactsManager } from '@/components/admin/contacts-manager'
import { MailOrganizer } from '@/components/admin/mail-organizer'
import { MailSidebar } from '@/components/admin/mail-sidebar'
import { ComposeForm } from '@/components/admin/compose-form'
import { EMAIL_CONFIGURED } from '@/lib/email'
import { getT } from '@/lib/i18n/server'

export const dynamic = 'force-dynamic'

type View = Folder | 'stiki' | 'urejanje' | 'folder' | 'compose'

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ folder?: string }>
}) {
  // Guard here too (not just in the layout): the layout and page render
  // concurrently, so without this the page's data actions could throw
  // "Unauthorized" and break the page instead of cleanly redirecting.
  if (!(await isAdmin())) redirect('/admin/login')

  const { folder: folderParam } = await searchParams

  // A custom folder is addressed as "f<id>"; everything else is a built-in view.
  const customFolderId =
    folderParam && /^f\d+$/.test(folderParam)
      ? Number(folderParam.slice(1))
      : undefined

  const view: View =
    customFolderId != null
      ? 'folder'
      : folderParam === 'poslano'
        ? 'poslano'
        : folderParam === 'izbrisano'
          ? 'izbrisano'
          : folderParam === 'stiki'
            ? 'stiki'
            : folderParam === 'urejanje'
              ? 'urejanje'
              : folderParam === 'compose'
                ? 'compose'
                : 'prejeto'

  // Folders + labels are always needed (tabs + inbox controls).
  const [folders, labels, t] = await Promise.all([
    getFolders(),
    getLabels(),
    getT(),
  ])

  const contacts = view === 'stiki' ? await getContacts() : []
  const rules = view === 'urejanje' ? await getRules() : []

  const isMailView =
    view === 'prejeto' ||
    view === 'poslano' ||
    view === 'izbrisano' ||
    view === 'folder'

  const rows = isMailView
    ? await getMessages(
        view === 'folder'
          ? { folderId: customFolderId }
          : { folder: view as Folder },
      )
    : []
  const initial = rows.map((r) => ({
    ...r,
    createdAt:
      r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
  })) as Message[]

  const activeKey =
    view === 'folder' ? `f${customFolderId}` : (folderParam ?? 'prejeto')

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="mb-4 font-serif text-2xl text-foreground">
        {t('Mailbox')}
      </h1>

      {!EMAIL_CONFIGURED && isMailView && (
        <p className="mb-5 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-muted-foreground">
          {t(
            'Messages from the website are collected here. To send replies and notifications by email, add your',
          )}{' '}
          <code>RESEND_API_KEY</code>.
        </p>
      )}

      {view === 'stiki' || view === 'urejanje' || view === 'compose' ? (
        <div className="grid gap-6 lg:grid-cols-[210px_1fr]">
          <MailSidebar activeKey={activeKey} folders={folders} />
          {view === 'stiki' ? (
            <ContactsManager initial={contacts} />
          ) : view === 'compose' ? (
            <ComposeForm configured={EMAIL_CONFIGURED} />
          ) : (
            <MailOrganizer folders={folders} rules={rules} labels={labels} />
          )}
        </div>
      ) : (
        <InboxManager
          key={activeKey}
          initial={initial}
          folder={view === 'folder' ? 'prejeto' : (view as Folder)}
          folderId={customFolderId}
          folders={folders}
          labels={labels}
          activeKey={activeKey}
        />
      )}
    </div>
  )
}
